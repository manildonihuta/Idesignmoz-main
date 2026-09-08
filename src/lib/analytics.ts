import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AnalyticsEventName, TrackInput } from "@/lib/analytics-client";

/* --------------------------------------------------------------------- *
 * Types (shared with the client beacon)
 * --------------------------------------------------------------------- */

export type { AnalyticsEventName, TrackInput } from "@/lib/analytics-client";

export type FunnelStage = {
  key: AnalyticsEventName;
  label: string;
  visitors: number;
};

export type AnalyticsReport = {
  period: { from: string; to: string; label: string };
  kpis: {
    visitors: number;
    domainSearches: number;
    signups: number;
    cartAdds: number;
    checkouts: number;
    purchases: number;
    domainPurchases: number;
    hostingPurchases: number;
    servicePurchases: number;
    revenue: number;
    mrr: number;
    arr: number;
    customers: number;
  };
  funnel: FunnelStage[];
};

/* --------------------------------------------------------------------- *
 * Server: record a single analytics event (service-role write)
 * @param visitorId  opaque anonymous per-browser id
 * --------------------------------------------------------------------- */

export async function recordAnalyticsEvent(
  visitorId: string,
  input: TrackInput,
): Promise<void> {
  if (!visitorId || !input.event) return;
  try {
    await supabaseAdmin.from("analytics_events").insert({
      visitor_id: visitorId.slice(0, 128),
      event: input.event,
      page: input.page ? input.page.slice(0, 512) : null,
      value: typeof input.value === "number" && Number.isFinite(input.value) ? input.value : null,
      meta: input.meta && typeof input.meta === "object" ? input.meta : null,
    });
  } catch {
    /* analytics must never break the hot path */
  }
}

/* --------------------------------------------------------------------- *
 * Server: build the admin Analytics report (KPIs + conversion funnel)
 * KPI revenue/mrr/arr/purchases are computed from real commerce tables;
 * visitor/funnel counts come from the anonymous analytics_events log.
 * --------------------------------------------------------------------- */

export type PeriodDays = 7 | 30 | 90;

const FUNNEL_STAGES: { key: AnalyticsEventName; label: string }[] = [
  { key: "pageview", label: "Visitors" },
  { key: "domain_search", label: "Domain Search" },
  { key: "signup", label: "Signup" },
  { key: "cart_add", label: "Cart" },
  { key: "checkout", label: "Checkout" },
  { key: "purchase", label: "Payment" },
  { key: "customer", label: "Customer" },
];

export function periodLabel(days: PeriodDays): string {
  if (days === 7) return "Últimos 7 dias";
  if (days === 30) return "Últimos 30 dias";
  return "Últimos 90 dias";
}

export async function getAnalyticsReport(days: PeriodDays): Promise<AnalyticsReport> {
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  /* ---- Funnel / visitor counts (anonymous events) ---- */
  const stage: Record<AnalyticsEventName, number> = {
    pageview: 0,
    domain_search: 0,
    signup: 0,
    cart_add: 0,
    checkout: 0,
    purchase: 0,
    customer: 0,
  };

  const { data: events } = await supabaseAdmin
    .from("analytics_events")
    .select("visitor_id, event")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  const visitorSets = new Map<AnalyticsEventName, Set<string>>();
  for (const name of Object.keys(stage) as AnalyticsEventName[]) visitorSets.set(name, new Set<string>());
  if (events) {
    for (const e of events) {
      const name = e.event as AnalyticsEventName;
      if (visitorSets.has(name) && typeof e.visitor_id === "string") {
        visitorSets.get(name)!.add(e.visitor_id);
      }
    }
  }
  for (const name of Object.keys(stage) as AnalyticsEventName[]) {
    stage[name] = visitorSets.get(name)?.size ?? 0;
  }

  /* ---- Commerce KPIs (real tables) ---- */

  const [paidPayments, paidDomainOrders, subscriptions, hostingCreated] = await Promise.all([
    supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("status", "paid")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabaseAdmin
      .from("domain_orders")
      .select("price")
      .in("status", ["paid", "registered"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabaseAdmin.from("subscriptions").select("price, period, status"),
    supabaseAdmin
      .from("hosting_accounts")
      .select("id")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
  ]);

  const revenue =
    (paidPayments.data ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0) +
    (paidDomainOrders.data ?? []).reduce((s, o) => s + (Number(o.price) || 0), 0);

  let mrr = 0;
  for (const sub of subscriptions.data ?? []) {
    if (sub.status !== "active") continue;
    const price = Number(sub.price) || 0;
    const months: Record<string, number> = { month: 1, quarter: 3, semiannual: 6, year: 12 };
    mrr += price / (months[sub.period as string] ?? 1);
  }

  const domainPurchases = paidDomainOrders.data?.length ?? 0;
  const hostingPurchases = hostingCreated.data?.length ?? 0;
  const kpis = {
    visitors: stage.pageview,
    domainSearches: stage.domain_search,
    signups: stage.signup,
    cartAdds: stage.cart_add,
    checkouts: stage.checkout,
    purchases: stage.purchase,
    domainPurchases,
    hostingPurchases,
    servicePurchases: 0,
    revenue,
    mrr,
    arr: mrr * 12,
    customers: stage.customer,
  };

  /* ---- Service purchases: paid orders that contain a service item ---- */
  try {
    const { data: serviceOrders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .in("status", ["paid", "completed", "processing"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    const ids = (serviceOrders ?? []).map((o) => o.id);
    if (ids.length) {
      const { count } = await supabaseAdmin
        .from("order_items")
        .select("order_id", { count: "exact", head: true })
        .in("order_id", ids)
        .eq("kind", "service");
      kpis.servicePurchases = count ?? 0;
    }
  } catch {
    /* ignore */
  }

  const funnel: FunnelStage[] = FUNNEL_STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    visitors: stage[s.key],
  }));

  return {
    period: { from: fromIso, to: toIso, label: periodLabel(days) },
    kpis,
    funnel,
  };
}
