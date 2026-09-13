import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { resolveUserEmail } from "@/lib/notifications/recipients";
import { selectEmailProvider } from "@/lib/provisioning/email/registry";
import { getCatalogProductRows } from "@/lib/content";
import { catalogPrice } from "@/lib/cart";
import { getSiteSettings } from "@/lib/site-settings";
import { computeTotals } from "@/lib/pricing";
import { generateOrderNumber } from "./payment.service";
import { ownedService } from "./email.service";
import { logEmailActivity } from "@/lib/provisioning/email/activity";
import { fail, type ServiceResult } from "./result";
import type { AuthContext } from "@/lib/client";
import type { BillingActor } from "./money.service";

const MIN_MONTHS = 1;
const MAX_MONTHS = 24;

type RenewalMeta = {
  service_id?: unknown;
  months?: unknown;
};

function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function metaServiceId(meta: Record<string, unknown> | null | undefined): string | null {
  const v = meta?.service_id;
  return typeof v === "string" && v ? v : null;
}

function metaMonths(meta: Record<string, unknown> | null | undefined): number | null {
  const v = meta?.months;
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  return v;
}

/** Server-side, authoritative renewal quote for an email service. */
export async function emailRenewalQuote(
  ctx: AuthContext,
  serviceId: string,
  months: number,
): Promise<ServiceResult<{ planName: string; months: number; pricePerMonth: number; subtotal: number; total: number }>> {
  const product = await renewalProduct(ctx, serviceId);
  if (!product.ok) return fail(product.status, product.error);

  const cents = renewPrice(product.pricePerMonth, months);
  if (!cents.ok) return fail(cents.status, cents.error);

  const settings = await getSiteSettings();
  const taxIncluded = settings.tax?.includedInPrices !== false;
  const totals = computeTotals({
    subtotal: cents.price,
    taxRate: Number(settings.tax?.rate ?? 15),
    taxIncludedInPrices: taxIncluded,
  });

  return {
    ok: true,
    planName: product.planName,
    months,
    pricePerMonth: product.pricePerMonth,
    subtotal: cents.price,
    total: totals.total,
  };
}

/**
 * Customer-routed renewal. Computes the price server-side from the catalog,
 * then writes a pending order + order item (meta.catalog_kind "email_renewal")
 * + payment — the same shape the manual checkout uses. The customer submits
 * proof and an admin settles it in the Cobranças panel; settlement extends the
 * service expiry and activates it again (see applyEmailRenewalFromOrderItem).
 */
export async function createEmailRenewalRequest(
  ctx: AuthContext,
  serviceId: string,
  input: { months: number; method: string; reference: string },
): Promise<ServiceResult<{ orderId: string; number: string; total: number; paymentId: string; pending: boolean; reference: string }>> {
  const product = await renewalProduct(ctx, serviceId);
  if (!product.ok) return fail(product.status, product.error);

  const cents = renewPrice(product.pricePerMonth, input.months);
  if (!cents.ok) return fail(cents.status, cents.error);

  const settings = await getSiteSettings();
  const taxIncluded = settings.tax?.includedInPrices !== false;
  const totals = computeTotals({
    subtotal: cents.price,
    taxRate: Number(settings.tax?.rate ?? 15),
    taxIncludedInPrices: taxIncluded,
  });

  const currency = "MZN";
  let orderNumber = generateOrderNumber();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) orderNumber = generateOrderNumber();
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        number: orderNumber,
        customer_id: ctx.userId ?? null,
        status: "pending",
        subtotal: cents.price,
        discount_amount: 0,
        tax_rate: totals.taxRate,
        tax_amount: totals.taxAmount,
        total: totals.total,
        currency,
        notes: `Renovação de email por ${input.method} · ref. ${input.reference}`,
      })
      .select("id, number")
      .single();

    if (orderError) {
      if (attempt < 2 && String(orderError.code ?? orderError.message).includes("23505")) {
        continue;
      }
      serverLogError("service:email-renewal.createOrder", orderError);
      return fail(500, "Não foi possível registar a ordem de renovação.");
    }

    const orderId = order.id;
    orderNumber = order.number ?? orderNumber;

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert({
      order_id: orderId,
      kind: "service",
      label: product.label,
      description: product.label,
      qty: 1,
      unit_price: cents.price,
      line_total: cents.price,
      meta: {
        currency,
        catalog_kind: "email_renewal",
        period: "monthly",
        product_id: product.productId ?? undefined,
        category: "email",
        service_id: product.serviceId,
        domain: product.domain,
        months: input.months,
        price_per_month: product.pricePerMonth,
      },
    });
    if (itemsError) {
      serverLogError("service:email-renewal.createItem", itemsError);
      return fail(500, "Não foi possível registar o item da renovação.");
    }

    const reference = input.reference;
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        customer_id: ctx.userId ?? null,
        order_id: orderId,
        method: input.method,
        reference,
        amount: totals.total,
        currency,
        status: "pending",
        meta: { source: "email_renewal", service_id: product.serviceId, months: input.months },
      })
      .select("id")
      .single();
    if (paymentError) {
      serverLogError("service:email-renewal.createPayment", paymentError);
      return fail(500, "Não foi possível registar o pagamento.");
    }

    await logAudit({
      action: AUDIT.ORDER_STATUS,
      entity: "order",
      entityId: orderId,
      actorId: ctx.userId,
      actorEmail: ctx.email,
      meta: { number: orderNumber, method: input.method, reference, renewal: true, pending: true },
    });

    return {
      ok: true,
      orderId,
      number: orderNumber,
      total: totals.total,
      paymentId: payment.id,
      pending: true,
      reference,
    };
  }

  return fail(500, "Não foi possível registar a ordem de renovação.");
}

/**
 * Post-settlement application for a paid "email_renewal" order item. Extends
 * the service expiry (anchor = max(now, current expiry)) and, if the service
 * was auto-suspended on expiry, reactivates it at the provider and clears the
 * expiry meta so the expiry cron no longer sees it as overdue.
 */
export async function applyEmailRenewalFromOrderItem(input: {
  meta: Record<string, unknown> | null | undefined;
  customerId: string | null;
  orderId: string;
  actor?: BillingActor;
}): Promise<ServiceResult<{ expiresAt: string; reactivated: boolean }>> {
  const serviceId = metaServiceId(input.meta);
  const months = metaMonths(input.meta);
  if (!serviceId || !months) {
    return fail(400, "Item de renovação inválido.");
  }

  const { data: service, error } = await supabaseAdmin
    .from("email_services")
    .select("id, customer_id, domain, plan_name, status, expires_at, provider_status, meta")
    .eq("id", serviceId)
    .maybeSingle();
  if (error || !service) {
    serverLogError("service:email-renewal.apply", error ?? new Error("missing service"));
    return fail(404, "Serviço de email não encontrado.");
  }

  const meta = (service.meta ?? {}) as Record<string, unknown>;
  const customerId = typeof service.customer_id === "string" ? service.customer_id : null;
  if (input.customerId && customerId && input.customerId !== customerId) {
    return fail(403, "O serviço não pertence a esta encomenda.");
  }

  const now = new Date();
  const base = new Date(service.expires_at ?? now.getTime());
  const expiresAt = base.getTime() > now.getTime() ? base : now;
  const newExpiresAt = addMonths(expiresAt, months);

  let reactivated = false;
  if (service.status === "suspended" && meta.expirySuspendedReason === "expired") {
    const selection = selectEmailProvider();
    try {
      const result = await selection.provider.reactivate({
        emailServiceId: String(service.id),
        domain: String(service.domain ?? ""),
        reason: "Renovação do serviço",
      });
      if (result.ok) reactivated = true;
    } catch (e) {
      serverLogError("service:email-renewal.reactivate.provider", e);
    }
  }

  const nextMeta: Record<string, unknown> = { ...meta };
  delete nextMeta.expirySuspendedAt;
  delete nextMeta.expirySuspendedReason;
  delete nextMeta.expiryStageSent;
  delete nextMeta.expiryStageSentAt;
  nextMeta.lastRenewedAt = now.toISOString();
  nextMeta.lastRenewedMonths = months;
  nextMeta.lastRenewedOrderId = input.orderId;

  const updates: Record<string, unknown> = {
    expires_at: newExpiresAt.toISOString(),
    meta: nextMeta,
    updated_at: now.toISOString(),
  };
  if (reactivated) {
    updates.status = "active";
    updates.provider_status = "active";
  }
  const { error: updErr } = await supabaseAdmin.from("email_services").update(updates).eq("id", service.id);
  if (updErr) {
    serverLogError("service:email-renewal.apply.update", updErr);
    return fail(500, "Renovação paga, mas não foi possível atualizar o prazo do serviço.");
  }

  const domain = String(service.domain ?? "");
  await logEmailActivity({
    serviceId: String(service.id),
    actor: input.actor?.userId ?? "system",
    action: "service.renewed",
    details: {
      domain,
      months,
      expiresAt: newExpiresAt.toISOString(),
      orderId: input.orderId,
      reactivated,
      actorEmail: input.actor?.email ?? null,
    },
  });
  await logAudit({
    action: AUDIT.EMAIL_SERVICE_RENEWED,
    entity: "email_service",
    entityId: String(service.id),
    actorId: input.actor?.userId,
    actorEmail: input.actor?.email,
    actorRole: input.actor?.role,
    ip: input.actor?.ip,
    meta: { domain, months, orderId: input.orderId, reactivated },
  });

  const email = customerId ? await resolveUserEmail(customerId) : undefined;
  await notifyEvent(
    "email.renewed",
    { domain, expiresAt: newExpiresAt.toISOString().slice(0, 10) },
    { recipients: customerId ? [{ userId: customerId, email }] : [] },
  );

  return { ok: true, expiresAt: newExpiresAt.toISOString(), reactivated };
}

/* ----------------------------- pricing helpers ---------------------------- */

async function renewalProduct(
  ctx: AuthContext,
  serviceId: string,
): Promise<
  | { ok: true; serviceId: string; domain: string; planName: string; pricePerMonth: number; productId: string | null; label: string }
  | { ok: false; status: number; error: string }
> {
  let service;
  try {
    service = await ownedService(ctx, serviceId);
  } catch (e) {
    const err = e as { status?: number; error?: string };
    return { ok: false, status: err.status ?? 400, error: err.error ?? "Serviço de email inválido." };
  }

  if (service.status === "cancelled" || service.status === "deleted") {
    return { ok: false, status: 409, error: "Este serviço de email já não está ativo." };
  }

  const products = await getCatalogProductRows();
  const match =
    products.find((p) => p.category === "email" && p.name === service.plan_name) ??
    products.find((p) => p.category === "email");
  if (!match) {
    return { ok: false, status: 503, error: "O plano de email não está disponível para renovação." };
  }

  return {
    ok: true,
    serviceId: service.id,
    domain: service.domain,
    planName: service.plan_name,
    pricePerMonth: catalogPrice(match, "monthly"),
    productId: match.id ?? null,
    label: `Renovação — ${service.plan_name} · ${service.domain}`,
  };
}

function renewPrice(pricePerMonth: number, months: number): { ok: true; price: number } | { ok: false; status: number; error: string } {
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) {
    return {
      ok: false,
      status: 400,
      error: `Indique a duração da renovação (${MIN_MONTHS}–${MAX_MONTHS} meses).`,
    };
  }
  const price = Math.round(pricePerMonth) * months;
  if (!Number.isSafeInteger(price) || price <= 0) {
    return { ok: false, status: 400, error: "Preço de renovação inválido." };
  }
  return { ok: true, price };
}

export type { RenewalMeta };