import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { CYCLE_LABELS, CYCLE_MONTHS, sellPeriodToCycle, type BillingCycle } from "@/lib/billing";
import { getCatalogProductRows } from "@/lib/content";
import { catalogPrice } from "@/lib/cart";
import { getSiteSettings } from "@/lib/site-settings";
import { computeTotals } from "@/lib/pricing";
import { resolveCoupon } from "@/lib/coupons";
import { createInvoiceFromOrder } from "@/services/invoice.service";
import type { SellPeriod } from "@/lib/catalog-types";

export const dynamic = "force-dynamic";

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
const AUTO_METHODS = new Set(["visa", "mastercard", "card"]);

function orderItemKind(itemKind: string): string {
  if (itemKind === "registration" || itemKind === "renewal") return "domain";
  if (itemKind === "hosting" || itemKind === "email") return "hosting";
  return "service";
}

function subscriptionKind(itemKind: string): string | null {
  if (itemKind === "hosting") return "hosting";
  if (itemKind === "email") return "service";
  if (itemKind === "seo" || itemKind === "marketing" || itemKind === "maintenance") return "service";
  return null;
}

type CartItemInput = {
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

type CustomerInput = Record<string, unknown>;

function generateOrderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "IDM-";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Next renewal instant for a billing cycle (mirrors billing.service). */
function nextRenewalDay(from: Date, cycle: BillingCycle): string {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + CYCLE_MONTHS[cycle]);
  return d.toISOString();
}

/**
 * Public checkout completion. Writes real commerce rows (orders, order_items,
 * payments, subscriptions) using the service role. Anonymous is allowed.
 *
 * Prices are NEVER trusted from the client — each item's price is re-derived
 * server-side from the DB catalog (catalog_products / domain_extensions) and
 * mismatching requests are rejected. The actual write is an atomic transaction
 * (complete_checkout or create_pending_checkout RPC depending on the payment
 * method); post-commit audit/notifications + invoice creation.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "checkout-complete",
    limit: 5,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: { customer?: CustomerInput; method?: unknown; reference?: unknown; items?: unknown; couponCode?: unknown };
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:checkout/complete", e);
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ ok: false, error: "O carrinho está vazio." }, { status: 400 });
  }
  if (typeof body.method !== "string" || typeof body.reference !== "string") {
    return Response.json({ ok: false, error: "Método ou referência de pagamento em falta." }, { status: 400 });
  }

  const items: CartItemInput[] = body.items.map((raw) => {
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

  const customer: CustomerInput = body.customer ?? {};
  const settings = await getSiteSettings();
  const taxRate = Number(settings.tax?.rate ?? 15);
  const taxIncluded = settings.tax?.includedInPrices !== false;

  // Authoritative price sources (server-side, never client-provided).
  const catalogProducts = await getCatalogProductRows();
  const catalogById = new Map(
    catalogProducts.map((product) => [product.id, product] as const),
  );
  const catalogByName = new Map(
    catalogProducts.map((product) => [product.name, product] as const),
  );

  const { data: extensions, error: extensionsError } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration, renewal")
    .eq("active", true);
  if (extensionsError) {
    serverLogError("api:checkout/complete", extensionsError);
    return Response.json({ ok: false, error: "Não foi possível validar a encomenda." }, { status: 500 });
  }
  const extensionsByTld = new Map(
    (extensions ?? []).map((ext) => [ext.extension, ext] as const),
  );

  const { data: hostingPlans, error: plansError } = await supabaseAdmin
    .from("hosting_plans")
    .select("id, slug, name, storage_gb")
    .eq("active", true);
  if (plansError) {
    serverLogError("api:checkout/complete", plansError);
    return Response.json({ ok: false, error: "Não foi possível validar a encomenda." }, { status: 500 });
  }
  const planBySlug = new Map((hostingPlans ?? []).map((plan) => [plan.slug, plan] as const));
  const planByName = new Map((hostingPlans ?? []).map((plan) => [plan.name, plan] as const));

  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  const customerId = user?.id ?? null;

  const orderCurrency: CurrencyCode = "MZN";

  // Validate + re-price every item from the DB, and build the write payloads.
  let subtotal = 0;
  const pItems: unknown[] = [];
  const pDomains: unknown[] = [];
  const pSubs: unknown[] = [];
  const pEmails: unknown[] = [];

  for (const item of items) {
    if (typeof item.label !== "string" || !item.label.trim()) {
      return Response.json({ ok: false, error: "Item do carrinho inválido." }, { status: 400 });
    }
    if (typeof item.kind !== "string" || !ITEM_KINDS.has(item.kind)) {
      return Response.json({ ok: false, error: "Tipo de produto inválido." }, { status: 400 });
    }
    if (typeof item.period !== "string" || !PERIODS.has(item.period)) {
      return Response.json({ ok: false, error: "Período de facturação inválido." }, { status: 400 });
    }
    // Money is integer minor units; only the principal (MZN) is accepted for
    // selling (multi-currency is prepared for the future).
    if (item.currency != null && item.currency !== "MZN") {
      if (!isCurrencyCode(item.currency)) {
        return Response.json({ ok: false, error: "Moeda inválida no carrinho." }, { status: 400 });
      }
      return Response.json({ ok: false, error: "Compras em moeda estrangeira ainda não disponíveis." }, { status: 400 });
    }

    const kind = String(item.kind);
    const orderKind = orderItemKind(kind);

    // Authoritative price for this item from the DB.
    let price: number;
    if (kind === "registration" || kind === "renewal") {
      const fullDomain = (typeof item.fullDomain === "string" ? item.fullDomain.trim() : "").toLowerCase();
      const dot = fullDomain.lastIndexOf(".");
      const extension = dot > 0 ? fullDomain.slice(dot) : "";
      const ext = extensionsByTld.get(extension);
      if (!ext) {
        return Response.json({ ok: false, error: "O domínio não está disponível para compra." }, { status: 400 });
      }
      const raw = kind === "registration" ? ext.registration : ext.renewal;
      price = Number(raw);
    } else {
      const productId = typeof item.productId === "string" && item.productId ? item.productId : null;
      const product =
        (productId ? catalogById.get(productId) : undefined) ??
        catalogByName.get(String(item.label));
      if (!product) {
        return Response.json({ ok: false, error: `Produto indisponível: ${item.label}.` }, { status: 400 });
      }
      price = catalogPrice(product, item.period as SellPeriod);
    }

    if (!Number.isSafeInteger(price) || price <= 0) {
      return Response.json({ ok: false, error: "Preço inválido no carrinho." }, { status: 400 });
    }
    if (typeof item.price !== "number" || item.price !== price) {
      return Response.json(
        { ok: false, error: "O preço de um produto mudou. Atualiza o carrinho e tenta de novo." },
        { status: 400 },
      );
    }
    subtotal += price;

    if (orderKind === "hosting" && !(typeof item.fullDomain === "string" && item.fullDomain.trim())) {
      return Response.json(
        { ok: false, error: "Seleciona o domínio para o alojamento antes de pagar." },
        { status: 400 },
      );
    }

    const itemProductRow =
      (typeof item.productId === "string" ? catalogById.get(item.productId) : undefined) ??
      catalogByName.get(String(item.label));
    const itemProductMeta = itemProductRow?.meta ?? {};

    pItems.push({
      kind: orderKind,
      label: item.label,
      description: item.label,
      qty: 1,
      unit_price: price,
      line_total: price,
      meta: {
        currency: orderCurrency,
        catalog_kind: kind,
        period: item.period,
        product_id: typeof item.productId === "string" ? item.productId : undefined,
        category: typeof item.category === "string" ? item.category : undefined,
        domain: typeof item.fullDomain === "string" && item.fullDomain ? item.fullDomain : undefined,
        ...(kind === "email"
          ? {
              mailboxes: Number(itemProductMeta.mailboxes ?? itemProductMeta.mailbox_limit ?? 5),
              storage_gb: Number(itemProductMeta.storage_gb ?? itemProductMeta.storage_limit_gb ?? 5),
            }
          : {}),
      },
    });

    // Domain registrations only — renewals are handled by the
    // admin/domain-manager flow, not the provisioning cron.
    if (kind === "registration" && typeof item.fullDomain === "string" && item.fullDomain.trim()) {
      const fullDomain = item.fullDomain.trim().toLowerCase();
      const dot = fullDomain.lastIndexOf(".");
      pDomains.push({
        full_domain: fullDomain,
        name: dot > 0 ? fullDomain.slice(0, dot) : fullDomain,
        extension: dot > 0 ? fullDomain.slice(dot) : "",
        email: typeof customer.email === "string" ? customer.email : "",
        price,
        customer_id: customerId,
      });
    }

    const subKind = subscriptionKind(kind);
    if (subKind && item.period !== "one_time") {
      const cycle = sellPeriodToCycle(item.period);
      if (!cycle) {
        return Response.json({ ok: false, error: "Período de facturação inválido." }, { status: 400 });
      }
      const renewsAt = nextRenewalDay(new Date(), cycle);
      const planId =
        (typeof item.productId === "string" ? planBySlug.get(item.productId) : undefined)?.id ??
        planByName.get(String(item.label))?.id ??
        null;
      const plan = planBySlug.get(String(item.productId ?? "")) ?? planByName.get(String(item.label));
      const subEntry: Record<string, unknown> = {
        customer_id: customerId,
        kind: subKind,
        plan_id: planId,
        period: cycle,
        price,
        currency: orderCurrency,
        renews_at: renewsAt,
        auto_renew: true,
        payment_method: String(body.method),
      };
      // Hosting/email: open the pending account now; the activation cron
      // provisions it (cPanel/WHM or simulated) and marks it active.
      if (subKind === "hosting") {
        subEntry.hosting = {
          plan_id: plan?.id ?? null,
          domain: typeof item.fullDomain === "string" ? item.fullDomain.trim().toLowerCase() : "",
          quota_gb: Number(plan?.storage_gb ?? 0),
        };
      }
      pSubs.push(subEntry);
    }

    // Email plans → one email service per domain (recurring only for now).
    if (kind === "email" && typeof item.fullDomain === "string" && item.fullDomain.trim() && item.period !== "one_time") {
      const cycle = sellPeriodToCycle(item.period);
      if (!cycle) {
        return Response.json({ ok: false, error: "Período de facturação inválido." }, { status: 400 });
      }
      const productRow =
        (typeof item.productId === "string" ? catalogById.get(item.productId) : undefined) ??
        catalogByName.get(String(item.label));
      const productMeta = productRow?.meta ?? {};
      const fullDomain = item.fullDomain.trim().toLowerCase();
      pEmails.push({
        customer_id: customerId,
        catalog_product_id: typeof item.productId === "string" ? item.productId : null,
        domain: fullDomain,
        plan_name: String(item.label),
        period: cycle,
        mailbox_limit: Number(productMeta.mailboxes ?? productMeta.mailbox_limit ?? 5),
        storage_limit_gb: Number(productMeta.storage_gb ?? productMeta.storage_limit_gb ?? 5),
        expires_at: nextRenewalDay(new Date(), cycle),
        dns_status: "pending",
        meta: {
          catalog_kind: kind,
          period: item.period,
          currency: orderCurrency,
          domain: fullDomain,
          planName: String(item.label),
          mailboxes: Number(productMeta.mailboxes ?? productMeta.mailbox_limit ?? 5),
          storage_gb: Number(productMeta.storage_gb ?? productMeta.storage_limit_gb ?? 5),
        },
      });
    }
  }

  const currency = orderCurrency;
  let orderNumber = generateOrderNumber();

  // Coupon
  let resolvedCoupon: { id: string; kind: "percent" | "fixed"; value: number; maxDiscount: number | null } | null = null;
  if (typeof body.couponCode === "string" && body.couponCode.trim()) {
    const couponRes = await resolveCoupon(body.couponCode.trim(), subtotal);
    if (!couponRes.ok) {
      return Response.json({ ok: false, error: couponRes.error }, { status: couponRes.status });
    }
    resolvedCoupon = {
      id: couponRes.coupon.id,
      kind: couponRes.coupon.kind,
      value: Number(couponRes.coupon.value),
      maxDiscount: couponRes.coupon.max_discount,
    };
  }

  // Compute totals (discount, tax, total) — single source of truth.
  const totals = computeTotals({
    subtotal,
    coupon: resolvedCoupon
      ? { kind: resolvedCoupon.kind, value: resolvedCoupon.value, maxDiscount: resolvedCoupon.maxDiscount }
      : null,
    taxRate,
    taxIncludedInPrices: taxIncluded,
  });

  const isManualMethod = !AUTO_METHODS.has(String(body.method));

  /* ------------------------------------------------------------------ *
   * Manual / proof-first methods → create_pending_checkout (deferred)
   * ------------------------------------------------------------------ */
  if (isManualMethod) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) orderNumber = generateOrderNumber();
      const { data, error } = await supabaseAdmin.rpc("create_pending_checkout", {
        p_order: {
          number: orderNumber,
          customer_id: customerId,
          subtotal,
          discount_amount: totals.discount,
          tax_rate: taxRate,
          tax_amount: totals.taxAmount,
          total: totals.total,
          currency,
          coupon_id: resolvedCoupon?.id ?? null,
          notes: `Pagamento por ${body.method} · ref. ${body.reference}`,
        },
        p_items: pItems,
        p_payment: {
          customer_id: customerId,
          method: String(body.method),
          reference: String(body.reference),
          amount: totals.total,
          currency,
          meta: {
            source: "checkout",
            customer: {
              full_name: typeof customer.fullName === "string" ? customer.fullName : undefined,
              email: typeof customer.email === "string" ? customer.email : undefined,
              phone: typeof customer.phone === "string" ? customer.phone : undefined,
            },
          },
        },
      });

      if (error) {
        if (attempt < 2 && String(error.code ?? error.message).includes("23505")) {
          continue;
        }
        serverLogError("api:checkout/complete.create_pending", error);
        return Response.json({ ok: false, error: "Não foi possível registar a encomenda." }, { status: 500 });
      }

      const pending = data as {
        order_id: string;
        payment_id: string;
        number: string;
        status: string;
      };

      await logAudit({
        action: AUDIT.ORDER_STATUS,
        entity: "order",
        entityId: pending.order_id,
        actorId: customerId ?? undefined,
        meta: { number: pending.number, method: body.method, reference: body.reference, pending: true },
      });

      return Response.json(
        {
          ok: true,
          orderId: pending.order_id,
          number: pending.number,
          total: totals.total,
          pending: true,
          paymentId: pending.payment_id,
        },
        { status: 200 },
      );
    }
    return Response.json({ ok: false, error: "Não foi possível registar a encomenda." }, { status: 500 });
  }

  /* ------------------------------------------------------------------ *
   * Auto-settle methods → complete_checkout (instant)
   * ------------------------------------------------------------------ */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) orderNumber = generateOrderNumber();
    const { data, error } = await supabaseAdmin.rpc("complete_checkout", {
      p_order: {
        number: orderNumber,
        customer_id: customerId,
        status: "paid",
        subtotal,
        discount_amount: totals.discount,
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        total: totals.total,
        currency,
        coupon_id: resolvedCoupon?.id ?? null,
        notes: `Pagamento por ${body.method} · ref. ${body.reference}`,
      },
      p_items: pItems,
      p_payment: {
        customer_id: customerId,
        method: String(body.method),
        reference: String(body.reference),
        amount: totals.total,
        currency,
        meta: {
          source: "checkout",
          customer: {
            full_name: typeof customer.fullName === "string" ? customer.fullName : undefined,
            email: typeof customer.email === "string" ? customer.email : undefined,
            phone: typeof customer.phone === "string" ? customer.phone : undefined,
          },
        },
      },
      p_domains: pDomains,
      p_subs: pSubs,
      p_email: pEmails,
    });

    if (error) {
      // The RPC is transactional: a duplicate order number aborts nothing
      // else, so retrying with a fresh number is safe.
      if (attempt < 2 && String(error.code ?? error.message).includes("23505")) {
        continue;
      }
      serverLogError("api:checkout/complete", error);
      return Response.json({ ok: false, error: "Não foi possível registar a encomenda." }, { status: 500 });
    }

    const result = data as {
      order_id: string;
      number: string;
      status: string;
      pending: boolean;
      subscriptions: Array<{
        id: string;
        kind: string;
        period: string;
        price: number;
        currency: string;
        renews_at: string | null;
      }>;
    };

    // Post-commit: invoice + side effects.
    try {
      const paidOrder = {
        id: result.order_id,
        number: result.number,
        customer_id: customerId,
        status: "paid" as const,
        subtotal,
        discount_amount: totals.discount,
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        total: totals.total,
        currency,
        notes: `Pagamento por ${body.method} · ref. ${body.reference}`,
      };
      const invoice = await createInvoiceFromOrder(paidOrder, {
        id: result.order_id,
        paid_at: new Date().toISOString(),
      });
      // Link invoice to the payment row.
      await supabaseAdmin
        .from("payments")
        .update({ invoice_id: invoice.id })
        .eq("order_id", result.order_id);
    } catch (e) {
      serverLogError("api:checkout/complete.invoice", e);
    }

    for (const sub of result.subscriptions ?? []) {
      await logAudit({
        action: AUDIT.SUBSCRIPTION_CREATED,
        entity: "subscription",
        entityId: sub.id,
        actorId: customerId ?? undefined,
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
        period: CYCLE_LABELS[sub.period as BillingCycle] ?? sub.period,
        price: sub.price,
      });
    }

    return Response.json(
      {
        ok: true,
        orderId: result.order_id,
        number: result.number,
        total: totals.total,
        pending: result.pending,
      },
      { status: 200 },
    );
  }

  return Response.json({ ok: false, error: "Não foi possível registar a encomenda." }, { status: 500 });
}