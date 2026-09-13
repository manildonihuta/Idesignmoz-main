/**
 * Pure builders that reconstruct the domain-registration + subscription
 * payloads needed by the materialization RPCs. Used at settlement time from
 * the persisted order_items meta (the checkout path builds the same shapes).
 */

import { CYCLE_MONTHS, sellPeriodToCycle } from "@/lib/billing";
import type { BillingCycle } from "@/lib/billing";

export type StoredOrderItem = {
  kind: string;                       // order kind: domain | hosting | service
  label: string;
  unit_price: number | null | undefined;
  meta: Record<string, unknown> | null | undefined;
};

export type PlanRef = { id: string; storage_gb: number };

export type SettlementPayloads = {
  domains: unknown[];
  subs: unknown[];
  emails: unknown[];
};

function orderLabel(meta: Record<string, unknown> | null | undefined): string {
  return typeof meta?.period === "string" ? String(meta.period) : "one_time";
}

function subscriptionKind(catalogKind: string): "hosting" | "service" | null {
  if (catalogKind === "hosting") return "hosting";
  if (catalogKind === "email" || catalogKind === "seo" || catalogKind === "marketing" || catalogKind === "maintenance")
    return "service";
  return null;
}

function nextRenewal(from: Date, cycle: BillingCycle): string {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + CYCLE_MONTHS[cycle]);
  return d.toISOString();
}

export function buildSettlementPayloads(opts: {
  items: StoredOrderItem[];
  customerId: string | null;
  method: string | null;
  currency: string;
  planBySlug: Map<string, PlanRef>;
  planByName: Map<string, PlanRef>;
}): SettlementPayloads {
  const domains: unknown[] = [];
  const subs: unknown[] = [];
  const emails: unknown[] = [];

  for (const item of opts.items) {
    const meta = item.meta ?? {};
    const catalogKind = typeof meta.catalog_kind === "string" ? String(meta.catalog_kind) : item.kind;
    const price = Number(item.unit_price ?? 0);
    const period = orderLabel(meta);
    const fullDomain = typeof meta.domain === "string" && meta.domain ? String(meta.domain) : "";

    if (catalogKind === "registration" && fullDomain) {
      const dot = fullDomain.lastIndexOf(".");
      domains.push({
        full_domain: fullDomain,
        name: dot > 0 ? fullDomain.slice(0, dot) : fullDomain,
        extension: dot > 0 ? fullDomain.slice(dot) : "",
        email: typeof meta.email === "string" ? meta.email : "",
        price,
        customer_id: opts.customerId,
      });
    }

    const subKind = subscriptionKind(catalogKind);
    if (subKind && period !== "one_time") {
      const cycle = sellPeriodToCycle(period);
      if (!cycle) continue;
      const productId = typeof meta.product_id === "string" ? meta.product_id : "";
      const planRef =
        (productId ? opts.planBySlug.get(productId) : undefined) ??
        opts.planByName.get(item.label) ??
        null;
      const sub: Record<string, unknown> = {
        customer_id: opts.customerId,
        kind: subKind,
        plan_id: planRef?.id ?? null,
        period: cycle,
        price,
        currency: opts.currency || "MZN",
        renews_at: nextRenewal(new Date(), cycle),
        auto_renew: true,
        payment_method: opts.method,
      };
      if (subKind === "hosting" && fullDomain) {
        sub.hosting = {
          plan_id: planRef?.id ?? null,
          domain: fullDomain,
          quota_gb: Number(planRef?.storage_gb ?? 0),
        };
      }
      subs.push(sub);
    }

    if (catalogKind === "email" && fullDomain) {
      const cycle = sellPeriodToCycle(period);
      if (cycle) {
        const productId = typeof meta.product_id === "string" ? meta.product_id : "";
        emails.push({
          customer_id: opts.customerId,
          catalog_product_id: productId || null,
          domain: fullDomain,
          plan_name: item.label,
          period: cycle,
          mailbox_limit: Number(meta.mailboxes ?? meta.mailbox_limit ?? 5),
          storage_limit_gb: Number(meta.storage_gb ?? meta.storage_limit_gb ?? 5),
          expires_at: nextRenewal(new Date(), cycle),
          dns_status: "pending",
          meta,
        });
      }
    }
  }

  return { domains, subs, emails };
}