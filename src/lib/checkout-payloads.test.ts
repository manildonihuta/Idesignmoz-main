import { describe, expect, it } from "vitest";
import type { BillingCycle } from "@/lib/billing";

import { buildSettlementPayloads } from "@/lib/checkout-payloads";
import type { PlanRef, StoredOrderItem } from "@/lib/checkout-payloads";

const hostingPlan: PlanRef = { id: "pl-h1", storage_gb: 10 };
const planBySlug = new Map<string, PlanRef>([["basic", hostingPlan]]);
const planByName = new Map<string, PlanRef>([["Alojamento Basic", hostingPlan]]);

function item(partial: Partial<StoredOrderItem>): StoredOrderItem {
  return { kind: "service", label: "item", unit_price: 0, meta: null, ...partial };
}

describe("buildSettlementPayloads", () => {
  it("builds a domain registration payload from meta.domain", () => {
    const { domains } = buildSettlementPayloads({
      items: [
        item({
          kind: "domain",
          label: "idesignmoz.com",
          unit_price: 800,
          meta: { catalog_kind: "registration", domain: "idesignmoz.com", email: "a@b.com", period: "one_time" },
        }),
      ],
      customerId: "cust-1",
      method: "mpesa",
      currency: "MZN",
      planBySlug,
      planByName,
    });
    expect(domains).toHaveLength(1);
    const d = domains[0] as Record<string, unknown>;
    expect(d.full_domain).toBe("idesignmoz.com");
    expect(d.name).toBe("idesignmoz");
    expect(d.extension).toBe(".com");
    expect(d.email).toBe("a@b.com");
    expect(d.price).toBe(800);
    expect(d.customer_id).toBe("cust-1");
  });

  it("builds a hosting subscription with hostings when plan resolves by slug", () => {
    const items: StoredOrderItem[] = [
      item({
        kind: "hosting",
        label: "Alojamento Basic",
        unit_price: 3000,
        meta: {
          catalog_kind: "hosting",
          domain: "idesignmoz.com",
          period: "monthly",
          product_id: "basic",
        },
      }),
    ];
    const { subs } = buildSettlementPayloads({
      items,
      customerId: "cust-1",
      method: "mpesa",
      currency: "MZN",
      planBySlug,
      planByName,
    });
    expect(subs).toHaveLength(1);
    const s = subs[0] as Record<string, unknown> & { hosting: Record<string, unknown> };
    expect(s.kind).toBe("hosting");
    expect(s.plan_id).toBe("pl-h1");
    expect(s.period).toBe("month");
    expect(s.payment_method).toBe("mpesa");
    expect(s.auto_renew).toBe(true);
    expect(s.hosting.domain).toBe("idesignmoz.com");
    expect(s.hosting.quota_gb).toBe(10);
    expect(typeof s.renews_at).toBe("string");
  });

  it("maps one-time purchases, email and maintenance correctly", () => {
    const { subs } = buildSettlementPayloads({
      items: [
        item({
          kind: "domain",
          label: "site.com",
          unit_price: 800,
          meta: { catalog_kind: "registration", domain: "site.com", period: "one_time" },
        }),
        item({
          kind: "email",
          label: "Email Basic",
          unit_price: 500,
          meta: { catalog_kind: "email", period: "monthly", product_id: "basic", domain: "site.com" },
        }),
        item({
          kind: "service",
          label: "SEO",
          unit_price: 2000,
          meta: { catalog_kind: "seo", period: "monthly" },
        }),
      ],
      customerId: null,
      method: "card",
      currency: "MZN",
      planBySlug,
      planByName,
    });
    expect(subs.map((s) => (s as Record<string, unknown>).kind)).toEqual(["hosting", "service"]);
  });

  it("skips one_time subscriptions (no cycle)", () => {
    const { subs } = buildSettlementPayloads({
      items: [
        item({
          kind: "service",
          label: "Site novo",
          unit_price: 5000,
          meta: { catalog_kind: "marketing", period: "one_time" },
        }),
      ],
      customerId: "c",
      method: "card",
      currency: "MZN",
      planBySlug,
      planByName,
    });
    expect(subs).toHaveLength(0);
  });

  it("resolves plan by name when product_id is missing", () => {
    const { subs } = buildSettlementPayloads({
      items: [
        item({
          kind: "hosting",
          label: "Alojamento Basic",
          unit_price: 3000,
          meta: { catalog_kind: "hosting", domain: "x.com", period: "annual" },
        }),
      ],
      customerId: "c",
      method: "bank-transfer",
      currency: "MZN",
      planBySlug,
      planByName,
    });
    const s = subs[0] as { period: BillingCycle; plan_id: string | null };
    expect(s.plan_id).toBe("pl-h1");
    expect(s.period).toBe("year");
  });
});