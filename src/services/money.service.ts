import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { putObject } from "@/lib/storage";
import { buildSettlementPayloads } from "@/lib/checkout-payloads";
import { createInvoiceFromOrder } from "./invoice.service";
import { fail, type ServiceResult } from "./result";

export type BillingActor = {
  userId?: string;
  email?: string;
  role?: string;
  ip?: string;
};

export type ProofUpload = {
  file: Uint8Array;
  mime: string;
  fileName: string;
  notes?: string;
};

/* --------------------------------------------------------------------- *
 * Credits (credit_ledger)
 * --------------------------------------------------------------------- */

async function ledgerBalance(customerId: string): Promise<number> {
  const { data: rows } = await supabaseAdmin
    .from("credit_ledger")
    .select("amount")
    .eq("customer_id", customerId)
    .limit(10000);
  return (rows ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

async function insertLedgerEntry(opts: {
  customerId: string;
  amount: number;
  reason: string;
  orderId?: string | null;
  refundId?: string | null;
  meta?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<boolean> {
  const balance = await ledgerBalance(opts.customerId);
  const { error } = await supabaseAdmin.from("credit_ledger").insert({
    customer_id: opts.customerId,
    order_id: opts.orderId ?? null,
    refund_id: opts.refundId ?? null,
    amount: opts.amount,
    reason: opts.reason,
    balance_after: balance + opts.amount,
    meta: opts.meta ?? null,
    created_by: opts.createdBy ?? null,
  });
  if (error) {
    serverLogError("service:money.ledger", error);
    return false;
  }
  return true;
}

export async function getCreditBalance(
  customerId: string,
): Promise<ServiceResult<{ balance: number }>> {
  if (!customerId) return { ok: true, balance: 0 };
  return { ok: true, balance: await ledgerBalance(customerId) };
}

export async function addCredit(input: {
  customerId: string;
  amount: number;
  reason: string;
  meta?: Record<string, unknown>;
  actor?: BillingActor;
}): Promise<ServiceResult<{ balance: number }>> {
  const amount = Math.round(input.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return fail(400, "Valor de crédito inválido.");
  }
  const ok = await insertLedgerEntry({
    customerId: input.customerId,
    amount,
    reason: input.reason,
    meta: input.meta,
    createdBy: input.actor?.userId ?? null,
  });
  if (!ok) return fail(500, "Não foi possível registar o crédito.");

  await logAudit({
    action: AUDIT.CREDIT_ISSUED,
    entity: "credit_ledger",
    actorId: input.actor?.userId,
    actorEmail: input.actor?.email,
    actorRole: input.actor?.role,
    ip: input.actor?.ip,
    meta: { customerId: input.customerId, amount, reason: input.reason },
  });
  await notifyEvent("credit.issued", { amount, reason: input.reason });

  return { ok: true, balance: await ledgerBalance(input.customerId) };
}

/* --------------------------------------------------------------------- *
 * Payment proofs + manual settlement
 * --------------------------------------------------------------------- */

export async function uploadPaymentProof(input: {
  customerId: string;
  paymentId: string;
  proof: ProofUpload;
  actor?: BillingActor;
}): Promise<ServiceResult<{ proofId: string; status: string }>> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("id, customer_id, status, method, order_id")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (error || !payment) return fail(404, "Pagamento não encontrado.");
  if (payment.status !== "pending") {
    return fail(409, "Este pagamento já não está pendente.");
  }
  if (payment.customer_id && payment.customer_id !== input.customerId) {
    return fail(403, "Este pagamento não lhe pertence.");
  }

  const safe = input.proof.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
  const key = `payment-proofs/${input.paymentId}/${Date.now()}-${safe}`;
  const result = await putObject(key, input.proof.file, input.proof.mime || "application/octet-stream");
  if (!result.ok) {
    return fail(503, "Não foi possível guardar o comprovativo. Tenta de novo.");
  }

  const { data: proof, error: proofError } = await supabaseAdmin
    .from("payment_proofs")
    .insert({
      payment_id: input.paymentId,
      customer_id: input.customerId,
      file_key: result.key,
      file_url: result.url,
      mime: input.proof.mime || "application/octet-stream",
      size_bytes: input.proof.file.byteLength,
      notes: input.proof.notes ?? null,
      status: "pending",
    })
    .select("id, status")
    .single();
  if (proofError) {
    serverLogError("service:money.proof", proofError);
    return fail(500, "Não foi possível registar o comprovativo.");
  }

  await supabaseAdmin
    .from("payments")
    .update({ proof_id: proof.id, updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  await logAudit({
    action: AUDIT.PAYMENT_PROOF_UPLOADED,
    entity: "payment",
    entityId: payment.id as string,
    actorId: input.customerId,
    meta: { proofId: proof.id, method: payment.method },
  });
  await notifyEvent("payment.pending", { reference: null, method: payment.method });

  return { ok: true, proofId: proof.id, status: "pending" };
}

export async function settlePendingPayment(
  paymentId: string,
  actor?: BillingActor,
): Promise<ServiceResult<{ orderId: string; number: string | null; status: string }>> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !payment) return fail(404, "Pagamento não encontrado.");
  if (payment.status !== "pending") {
    return fail(409, "Este pagamento já não está pendente.");
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (!order) return fail(404, "Encomenda não encontrada.");
  if (order.status !== "pending") {
    return fail(409, "A encomenda já não está pendente.");
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("kind, label, unit_price, meta")
    .eq("order_id", payment.order_id);

  const { data: plans } = await supabaseAdmin
    .from("hosting_plans")
    .select("id, slug, name, storage_gb")
    .eq("active", true);
  const planBySlug = new Map(
    (plans ?? []).map((p) => [p.slug, { id: p.id, storage_gb: Number(p.storage_gb ?? 0) }] as const),
  );
  const planByName = new Map(
    (plans ?? []).map((p) => [p.name, { id: p.id, storage_gb: Number(p.storage_gb ?? 0) }] as const),
  );

  const payloads = buildSettlementPayloads({
    items: (items ?? []) as Parameters<typeof buildSettlementPayloads>[0]["items"],
    customerId: payment.customer_id,
    method: payment.method,
    currency: order.currency ?? "MZN",
    planBySlug,
    planByName,
  });

  const { data: result, error: rpcError } = await supabaseAdmin.rpc(
    "settle_pending_order",
    {
      p_order_id: payment.order_id,
      p_payment_id: payment.id,
      p_domains: payloads.domains,
      p_subs: payloads.subs,
      p_email: payloads.emails,
    },
  );
  if (rpcError) {
    serverLogError("service:money.settle", rpcError);
    return fail(500, "Não foi possível confirmar o pagamento.");
  }
  const settled = result as { ok?: boolean; error?: string; order_id: string; number?: string | null; status?: string; subscriptions?: Array<Record<string, unknown>>; emails?: Array<Record<string, unknown>> };
  if (settled.ok === false) {
    return fail(409, settled.error ?? "Não foi possível confirmar o pagamento.");
  }

  const now = new Date();

  // Approve the newest submitted proof.
  const { data: proofs } = await supabaseAdmin
    .from("payment_proofs")
    .select("id")
    .eq("payment_id", payment.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  const proof = proofs?.[0];
  if (proof) {
    await supabaseAdmin
      .from("payment_proofs")
      .update({ status: "approved", reviewed_by: actor?.userId ?? null, reviewed_at: now.toISOString() })
      .eq("id", proof.id);
  }

  // Invoice for the now-paid order (consistent totals — tax/discount stored).
  let invoiceId: string | null = null;
  try {
    const invoice = await createInvoiceFromOrder(
      {
        id: order.id,
        number: order.number ?? settled.number ?? null,
        customer_id: order.customer_id,
        status: "paid",
        subtotal: Number(order.subtotal ?? 0),
        discount_amount: Number(order.discount_amount ?? 0),
        tax_rate: Number(order.tax_rate ?? 0),
        tax_amount: Number(order.tax_amount ?? 0),
        total: Number(order.total ?? 0),
        currency: order.currency ?? "MZN",
        notes: order.notes ?? null,
      },
      { id: payment.id, paid_at: now.toISOString() },
    );
    invoiceId = invoice.id;
    await supabaseAdmin.from("payments").update({ invoice_id: invoiceId }).eq("id", payment.id);
  } catch (e) {
    serverLogError("service:money.settle.invoice", e);
  }

  // Post-commit side effects: audit + notifications for the subscriptions.
  for (const sub of settled.subscriptions ?? []) {
    await logAudit({
      action: AUDIT.SUBSCRIPTION_CREATED,
      entity: "subscription",
      entityId: String(sub.id),
      actorId: actor?.userId ?? payment.customer_id ?? undefined,
      meta: {
        kind: sub.kind,
        period: sub.period,
        price: sub.price,
        currency: sub.currency,
        renewsAt: sub.renews_at ?? undefined,
      },
    });
    await notifyEvent("subscription.created", {
      kind: sub.kind,
      period: String(sub.period),
      price: Number(sub.price),
    });
  }

  // Email services materialized with this settlement.
  for (const email of settled.emails ?? []) {
    await logAudit({
      action: AUDIT.EMAIL_SERVICE_CREATED,
      entity: "email_service",
      entityId: String(email.id),
      actorId: actor?.userId ?? payment.customer_id ?? undefined,
      meta: { domain: email.domain, orderId: order.id },
    });
    await notifyEvent("email.service_created", {
      domain: String(email.domain ?? ""),
    });
  }

  await logAudit({
    action: AUDIT.PAYMENT_VERIFIED,
    entity: "payment",
    entityId: payment.id,
    actorId: actor?.userId,
    actorEmail: actor?.email,
    actorRole: actor?.role,
    ip: actor?.ip,
    meta: { orderId: order.id, method: payment.method, invoiceId },
  });
  await notifyEvent("payment.verified", {
    orderNumber: order.number ?? settled.number ?? "",
    amount: Number(order.total ?? 0),
  });

  return {
    ok: true,
    orderId: order.id,
    number: order.number ?? settled.number ?? null,
    status: String(settled.status ?? "processing"),
  };
}

export async function rejectPendingPayment(
  paymentId: string,
  reason: string,
  actor?: BillingActor,
): Promise<ServiceResult<{ orderId: string }>> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("id, status, order_id, customer_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !payment) return fail(404, "Pagamento não encontrado.");
  if (payment.status !== "pending") {
    return fail(409, "Este pagamento já não está pendente.");
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("payments")
    .update({ status: "failed", error_message: reason, updated_at: now })
    .eq("id", payment.id);
  await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", payment.order_id);
  await supabaseAdmin
    .from("payment_proofs")
    .update({ status: "rejected", reviewed_by: actor?.userId ?? null, reviewed_at: now })
    .eq("payment_id", payment.id)
    .eq("status", "pending");

  await logAudit({
    action: AUDIT.PAYMENT_REJECTED,
    entity: "payment",
    entityId: payment.id,
    actorId: actor?.userId,
    actorEmail: actor?.email,
    actorRole: actor?.role,
    ip: actor?.ip,
    meta: { orderId: payment.order_id, reason },
  });
  await notifyEvent("payment.rejected", { reason });

  return { ok: true, orderId: payment.order_id };
}

/* --------------------------------------------------------------------- *
 * Refunds
 * --------------------------------------------------------------------- */

/** Total amount already refunded for a payment. */
async function refundedTotal(paymentId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("refunds")
    .select("amount")
    .eq("payment_id", paymentId)
    .in("status", ["processed", "approved"]);
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

export async function requestRefund(input: {
  paymentId: string;
  amount: number;
  reason: string;
  notes?: string;
  actor?: BillingActor;
}): Promise<ServiceResult<{ refundId: string; status: string }>> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("id, order_id, customer_id, amount, status, currency, method")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (error || !payment) return fail(404, "Pagamento não encontrado.");
  if (payment.status !== "paid" && payment.status !== "partially_refunded") {
    return fail(409, "Só pagamentos pagos podem ser reembolsados.");
  }

  const amount = Math.round(input.amount);
  const already = await refundedTotal(payment.id as string);
  const remaining = Number(payment.amount ?? 0) - already;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > remaining) {
    return fail(400, "Valor de reembolso inválido.");
  }

  const { data: refund, error: refundError } = await supabaseAdmin
    .from("refunds")
    .insert({
      payment_id: payment.id,
      order_id: payment.order_id,
      customer_id: payment.customer_id,
      amount,
      currency: payment.currency ?? "MZN",
      reason: input.reason,
      method: payment.method,
      notes: input.notes ?? null,
      requested_by: input.actor?.userId ?? null,
      status: "requested",
    })
    .select("id, status")
    .single();
  if (refundError) {
    serverLogError("service:money.refund.request", refundError);
    return fail(500, "Não foi possível registar o pedido de reembolso.");
  }

  await logAudit({
    action: AUDIT.REFUND_REQUESTED,
    entity: "refund",
    entityId: refund.id,
    actorId: input.actor?.userId,
    actorEmail: input.actor?.email,
    actorRole: input.actor?.role,
    ip: input.actor?.ip,
    meta: { paymentId: payment.id, amount, reason: input.reason },
  });
  await notifyEvent("refund.requested", { amount, reason: input.reason });

  return { ok: true, refundId: refund.id, status: "requested" };
}

export async function approveRefund(input: {
  refundId: string;
  notes?: string;
  providerRef?: string;
  actor?: BillingActor;
}): Promise<ServiceResult<{ refundId: string; status: string }>> {
  const { data: refund, error } = await supabaseAdmin
    .from("refunds")
    .select("*")
    .eq("id", input.refundId)
    .maybeSingle();
  if (error || !refund) return fail(404, "Reembolso não encontrado.");
  if (refund.status !== "requested") {
    return fail(409, "Este reembolso já foi processado.");
  }

  const now = new Date();
  await supabaseAdmin
    .from("refunds")
    .update({
      status: "processed",
      notes: input.notes ?? refund.notes,
      provider_ref: input.providerRef ?? refund.provider_ref,
      reviewed_by: input.actor?.userId ?? null,
      processed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", refund.id);

  // Credit the money back to the customer.
  if (refund.customer_id) {
    await insertLedgerEntry({
      customerId: refund.customer_id,
      amount: Number(refund.amount ?? 0),
      reason: `Reembolso ${String(refund.reason ?? "")}`.trim(),
      orderId: refund.order_id,
      refundId: refund.id,
      createdBy: input.actor?.userId ?? null,
    });
  }

  // Payment + order states.
  const totalRefunded = (await refundedTotal(refund.payment_id as string)) + Number(refund.amount ?? 0);
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("amount, order_id, status, meta")
    .eq("id", refund.payment_id)
    .maybeSingle();
  if (payment) {
    const fullyRefunded = totalRefunded >= Number(payment.amount ?? 0);
    const meta = (payment.meta ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("payments")
      .update({
        status: fullyRefunded ? "refunded" : "partially_refunded",
        meta: { ...meta, refunded_amount: totalRefunded },
        updated_at: now.toISOString(),
      })
      .eq("id", refund.payment_id);
    if (fullyRefunded) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "refunded", updated_at: now.toISOString() })
        .eq("id", refund.order_id);
    }
  }

  await logAudit({
    action: AUDIT.REFUND_APPROVED,
    entity: "refund",
    entityId: refund.id,
    actorId: input.actor?.userId,
    actorEmail: input.actor?.email,
    actorRole: input.actor?.role,
    ip: input.actor?.ip,
    meta: { amount: refund.amount, reason: refund.reason, customerId: refund.customer_id },
  });
  await notifyEvent("refund.approved", { amount: Number(refund.amount ?? 0) });

  return { ok: true, refundId: refund.id, status: "processed" };
}

export async function rejectRefund(input: {
  refundId: string;
  notes?: string;
  actor?: BillingActor;
}): Promise<ServiceResult<{ refundId: string; status: string }>> {
  const { data: refund, error } = await supabaseAdmin
    .from("refunds")
    .select("id, status, notes")
    .eq("id", input.refundId)
    .maybeSingle();
  if (error || !refund) return fail(404, "Reembolso não encontrado.");
  if (refund.status !== "requested") {
    return fail(409, "Este reembolso já foi processado.");
  }
  await supabaseAdmin
    .from("refunds")
    .update({
      status: "rejected",
      notes: input.notes ?? refund.notes,
      reviewed_by: input.actor?.userId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", refund.id);
  await logAudit({
    action: AUDIT.REFUND_REJECTED,
    entity: "refund",
    entityId: refund.id,
    actorId: input.actor?.userId,
    actorEmail: input.actor?.email,
    actorRole: input.actor?.role,
    ip: input.actor?.ip,
    meta: {},
  });
  return { ok: true, refundId: refund.id, status: "rejected" };
}

/* --------------------------------------------------------------------- *
 * Admin data (Cobranças)
 * --------------------------------------------------------------------- */

export type AdminBillingData = {
  pendingPayments: Array<Record<string, unknown>>;
  recentPayments: Array<Record<string, unknown>>;
  refunds: Array<Record<string, unknown>>;
  credits: Array<Record<string, unknown>>;
  summary: {
    pending: number;
    pendingValue: number;
    refundsRequested: number;
    creditsIssued: number;
  };
};

export async function adminBillingData(
  limit = 50,
): Promise<ServiceResult<AdminBillingData>> {
  const [pendingRes, recentRes, refundsRes, creditsRes, profilesRes] = await Promise.all([
    supabaseAdmin
      .from("payments")
      .select(
        "id, order_id, customer_id, method, reference, amount, currency, status, created_at, payment_proofs( id, file_url, mime, status, created_at )",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("payments")
      .select("id, order_id, customer_id, customer:customers(full_name), method, reference, amount, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("refunds")
      .select("id, payment_id, order_id, customer_id, amount, currency, reason, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("credit_ledger")
      .select("id, customer_id, amount, reason, balance_after, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin.from("profiles").select("id, full_name"),
  ]);

  const nameById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
  const withName = <T extends { customer_id?: string | null }>(row: T): T & { customer_name?: string | null } => ({
    ...row,
    customer_name: row.customer_id ? (nameById.get(row.customer_id) ?? null) : null,
  });

  const pendingPayments = (pendingRes.data ?? []).map(withName);
  const summary = {
    pending: pendingRes.data?.length ?? 0,
    pendingValue: (pendingRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0),
    refundsRequested: (refundsRes.data ?? []).filter((r) => r.status === "requested").length,
    creditsIssued: (creditsRes.data ?? []).reduce(
      (s, c) => s + (Number(c.amount ?? 0) > 0 ? Number(c.amount) : 0),
      0,
    ),
  };

  return {
    ok: true,
    pendingPayments,
    recentPayments: (recentRes.data ?? []).map(withName),
    refunds: (refundsRes.data ?? []).map(withName),
    credits: (creditsRes.data ?? []).map(withName),
    summary,
  };
}