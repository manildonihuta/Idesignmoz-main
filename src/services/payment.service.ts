import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getProvider,
  generateReference,
  PROVIDERS,
  type PaymentMethodId,
  type PaymentIntent,
} from "@/lib/payment-providers";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { getSiteSettings } from "@/lib/site-settings";
import { notifyEvent } from "@/lib/notifications";
import { timingSafeEqualStr } from "@/lib/security/encryption";
import { serverLogError } from "@/lib/server-log";
import { listClientPayments, type ClientPayment } from "@/lib/client-data";
import type { AuthContext } from "@/lib/client";
import { createInvoiceFromOrder } from "./invoice.service";
import { createSubscription } from "./billing.service";
import { fail, type ServiceResult } from "./result";

const ITEM_KINDS = new Set([
  "registration",
  "renewal",
  "hosting",
  "email",
  "website",
  "branding",
  "software",
  "design",
  "seo",
  "marketing",
  "maintenance",
]);

const PERIODS = new Set(["one_time", "monthly", "quarterly", "semiannual", "annual"]);

export function orderItemKind(itemKind: string): string {
  if (itemKind === "registration" || itemKind === "renewal") return "domain";
  if (itemKind === "hosting" || itemKind === "email") return "hosting";
  return "service";
}

export function subscriptionKind(itemKind: string): string | null {
  if (itemKind === "hosting" || itemKind === "email") return "hosting";
  if (itemKind === "seo" || itemKind === "marketing" || itemKind === "maintenance") return "service";
  return null;
}

export function generateOrderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "IDM-";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export type CartItemInput = {
  fullDomain?: unknown;
  extension?: unknown;
  price?: unknown;
  currency?: unknown;
  kind?: unknown;
  label?: unknown;
  period?: unknown;
  productId?: unknown;
  category?: unknown;
};

export type CheckoutCustomerInput = Record<string, unknown>;

export type CreatedOrder = {
  orderId: string;
  number: string;
  total: number;
  currency: string;
  status: string;
};

/* --------------------------------------------------------------------- *
 * Step 1 — create the order (status pending). Prices come from the client
 * here only for validation; the authoritative catalog lives in the DB.
 * --------------------------------------------------------------------- */

export async function createOrder(body: {
  customer?: unknown;
  method?: unknown;
  reference?: unknown;
  items?: unknown;
}): Promise<ServiceResult<CreatedOrder>> {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return fail(400, "O carrinho está vazio.");
  }
  if (typeof body.method !== "string" || typeof body.reference !== "string") {
    return fail(400, "Método ou referência de pagamento em falta.");
  }

  const items: CartItemInput[] = (body.items as Record<string, unknown>[]).map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      fullDomain: item.fullDomain,
      extension: item.extension,
      price: item.price,
      currency: item.currency,
      kind: item.kind,
      label: item.label,
      period: item.period,
      productId: item.productId,
      category: item.category,
    };
  });

  let subtotal = 0;
  const orderCurrency: CurrencyCode = "MZN";
  for (const item of items) {
    if (typeof item.label !== "string" || !item.label.trim()) {
      return fail(400, "Item do carrinho inválido.");
    }
    if (typeof item.price !== "number" || !Number.isSafeInteger(item.price) || item.price <= 0) {
      return fail(400, "Preço inválido no carrinho.");
    }
    if (typeof item.kind !== "string" || !ITEM_KINDS.has(item.kind)) {
      return fail(400, "Tipo de produto inválido.");
    }
    if (typeof item.period !== "string" || !PERIODS.has(item.period)) {
      return fail(400, "Período de facturação inválido.");
    }
    if (item.currency != null && item.currency !== "MZN") {
      if (!isCurrencyCode(item.currency)) {
        return fail(400, "Moeda inválida no carrinho.");
      }
      return fail(400, "Compras em moeda estrangeira ainda não disponíveis.");
    }
    subtotal += item.price;
  }

  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  const customerId = user?.id ?? null;

  const currency = orderCurrency;
  let orderNumber = generateOrderNumber();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) orderNumber = generateOrderNumber();
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        number: orderNumber,
        customer_id: customerId,
        status: "pending",
        subtotal,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: subtotal,
        currency,
        notes: `Pagamento por ${body.method} · ref. ${body.reference}`,
      })
      .select("id, number")
      .single();

    if (orderError) {
      if (attempt < 2 && String(orderError.code ?? orderError.message).includes("23505")) {
        continue;
      }
      serverLogError("service:payment.createOrder", orderError);
      return fail(500, "Não foi possível registar a encomenda.");
    }

    const orderId = order.id;
    orderNumber = order.number ?? orderNumber;

    const orderItems = items.map((item) => ({
      order_id: orderId,
      kind: orderItemKind(String(item.kind)),
      label: String(item.label),
      description: String(item.label),
      qty: 1,
      unit_price: Number(item.price),
      line_total: Number(item.price),
      meta: {
        currency,
        catalog_kind: String(item.kind),
        period: String(item.period),
        product_id: typeof item.productId === "string" ? item.productId : undefined,
        category: typeof item.category === "string" ? item.category : undefined,
        domain: typeof item.fullDomain === "string" && item.fullDomain ? item.fullDomain : undefined,
      },
    }));

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (itemsError) {
      serverLogError("service:payment.createOrder", itemsError);
      return fail(500, "Não foi possível registar os itens.");
    }

    return { ok: true, orderId, number: orderNumber, total: subtotal, currency, status: "pending" };
  }

  return fail(500, "Não foi possível registar a encomenda.");
}

/* --------------------------------------------------------------------- *
 * Step 2 — create the payment intent (status pending) and dispatch it to
 * the configured gateway. The order stays pending until confirmed.
 * --------------------------------------------------------------------- */

export type PaymentCreateInput = {
  orderId: string;
  method: PaymentMethodId;
  phone?: string;
  customer?: CheckoutCustomerInput;
};

export type CreatedPayment = {
  paymentId: string;
  reference: string;
  status: string;
  message?: string;
  method: PaymentMethodId;
  amount: number;
  currency: string;
};

export async function createPayment(input: PaymentCreateInput): Promise<ServiceResult<CreatedPayment>> {
  const provider = getProvider(input.method);
  if (!provider) {
    return fail(400, "Método de pagamento inválido.");
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, number, status, total, currency, customer_id")
    .eq("id", input.orderId)
    .maybeSingle();

  if (error || !order) {
    return fail(404, "Encomenda não encontrada.");
  }
  if (order.status !== "pending") {
    return fail(409, "Esta encomenda já não está pendente.");
  }

  // Guard against a second pending intent racing the first one.
  const { data: existingPaid } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("order_id", input.orderId)
    .eq("status", "paid")
    .maybeSingle();
  if (existingPaid) {
    return fail(409, "Esta encomenda já foi paga.");
  }

  const customer = (input.customer ?? {}) as CheckoutCustomerInput;
  const reference = generateReference();

  const intent: PaymentIntent = {
    method: input.method,
    amount: Number(order.total),
    currency: String(order.currency ?? "MZN"),
    reference,
    customerPhone: input.phone || undefined,
    customerName: typeof customer.fullName === "string" ? customer.fullName : undefined,
  };

  const result = await provider.process(intent);

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({
      order_id: order.id,
      customer_id: order.customer_id,
      method: input.method,
      reference,
      amount: intent.amount,
      currency: intent.currency,
      status: "pending",
      meta: {
        source: "checkout",
        message: result.message,
        customer: {
          full_name: typeof customer.fullName === "string" ? customer.fullName : undefined,
          email: typeof customer.email === "string" ? customer.email : undefined,
          phone: typeof customer.phone === "string" ? customer.phone : undefined,
        },
      },
    })
    .select("id, reference")
    .single();

  if (paymentError) {
    serverLogError("service:payment.createPayment", paymentError);
    return fail(500, "Não foi possível registar o pagamento.");
  }

  return {
    ok: true,
    paymentId: payment.id,
    reference: payment.reference ?? reference,
    status: "pending",
    message: result.message,
    method: input.method,
    amount: intent.amount,
    currency: intent.currency,
  };
}

/* --------------------------------------------------------------------- *
 * Step 3 — confirm a pending payment by its reference (idempotent) and
 * settle the order: paid, subscriptions, invoice + notifications.
 * --------------------------------------------------------------------- */

export async function confirmByReference(
  reference: string,
  options: { source?: string; actorEmail?: string } = {},
): Promise<ServiceResult<{ already: boolean; payment: unknown; order: unknown }>> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (error || !payment) {
    return fail(404, "Pagamento não encontrado.");
  }

  if (payment.status === "paid") {
    return { ok: true, already: true, payment, order: null };
  }

  const now = new Date();
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", payment.order_id)
    .maybeSingle();

  if (orderError || !order) {
    return fail(404, "Encomenda não encontrada.");
  }

  // Mark the payment paid first so a webhook replay can't double-settle.
  await supabaseAdmin
    .from("payments")
    .update({ status: "paid", paid_at: now.toISOString() })
    .eq("id", payment.id);

  await supabaseAdmin
    .from("orders")
    .update({ status: "paid", updated_at: now.toISOString() })
    .eq("id", order.id);

  // Recurring subscriptions from the paid items (billing cycles supported:
  // monthly, quarterly, semiannual, annual).
  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("kind, label, qty, unit_price, meta")
    .eq("order_id", order.id);

  for (const item of orderItems ?? []) {
    const subKind = subscriptionKind(String(item.kind));
    const period = (item.meta as { period?: string } | null)?.period;
    if (!subKind || !period || period === "one_time") continue;
    const result = await createSubscription({
      customerId: order.customer_id,
      kind: subKind as "hosting" | "service",
      period,
      price: Number(item.unit_price) ?? 0,
      currency: order.currency ?? "MZN",
      autoRenew: true,
      paymentMethod: payment.method,
    });
    if (!result.ok) {
      serverLogError("service:payment.confirmByReference", new Error(result.error));
    }
  }

  // Invoice for the paid order.
  let invoiceId: string | null = null;
  try {
    const invoice = await createInvoiceFromOrder(order, payment);
    invoiceId = invoice.id;
    await supabaseAdmin.from("payments").update({ invoice_id: invoiceId }).eq("id", payment.id);
  } catch (e) {
    serverLogError("service:payment.confirmByReference", e);
  }

  const meta = (payment.meta ?? {}) as Record<string, unknown>;
  const customer = (meta.customer ?? {}) as { full_name?: string; email?: string; name?: string };
  const customerEmail = customer.email || customer.full_name;

  const itemMeta = (orderItems ?? []).find(
    (i) => typeof (i.meta as { domain?: unknown } | null)?.domain === "string",
  ) as { meta?: { domain?: string } } | undefined;
  const fullDomain = itemMeta?.meta?.domain ?? "";

  await notifyEvent(
    "payment.successful",
    {
      fullDomain,
      price: Number(order.total),
    },
    customerEmail
      ? { recipients: [{ email: customerEmail, name: customer.full_name }] }
      : { channels: ["dashboard"] },
  );

  return { ok: true, already: false, payment, order };
}

/* --------------------------------------------------------------------- *
 * Webhook — only sustaized by gateways; verified with PAYMENT_WEBHOOK_SECRET.
 * --------------------------------------------------------------------- */

export async function handleWebhook(
  rawInput: unknown,
  signatureHeader: string | null,
): Promise<ServiceResult<{ reference?: string; already?: boolean }>> {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signatureHeader || !timingSafeEqualStr(signatureHeader, secret)) {
    return fail(401, "Assinatura inválida.");
  }

  const body = (rawInput ?? {}) as { reference?: unknown; status?: unknown };
  const reference = typeof body.reference === "string" ? body.reference : "";
  if (!reference) {
    return fail(400, "Referência em falta.");
  }

  const settled = await confirmByReference(reference, { source: "webhook" });
  return settled.ok
    ? { ok: true, reference, already: settled.already }
    : (settled as { ok: false; error: string; status: number });
}

/* --------------------------------------------------------------------- *
 * Polling + client list
 * --------------------------------------------------------------------- */

export async function getStatus(reference: string): Promise<ServiceResult<{ payment: unknown; order: unknown }>> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (error || !payment) {
    return fail(404, "Pagamento não encontrado.");
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("number, status, total")
    .eq("id", payment.order_id)
    .maybeSingle();

  return { ok: true, payment, order };
}

export async function listClient(ctx: AuthContext): Promise<ClientPayment[]> {
  return listClientPayments(ctx);
}

/* --------------------------------------------------------------------- *
 * Payment methods surfaced to the client (driven by DB gateways config)
 * --------------------------------------------------------------------- */

export async function listMethods(): Promise<
  { id: PaymentMethodId; name: string; description: string; kind: string; enabled: boolean }[]
> {
  const settings = await getSiteSettings();
  const gateways = settings.payments?.gateways ?? {};
  return Object.values(PROVIDERS).map((provider) => ({
    id: provider.id,
    name: provider.name,
    description: provider.description,
    kind: provider.kind,
    enabled: gateways[provider.id] ? Boolean(gateways[provider.id].enabled) : true,
  }));
}