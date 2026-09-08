/* --------------------------------------------------------------------- *
 * Billing cycles — PURE module, safe on client and server.
 *
 * Maps the catalog sell periods (monthly/quarterly/semiannual/annual)
 * to the persisted subscription period values and their duration in months.
 * --------------------------------------------------------------------- */

export type BillingCycle = "month" | "quarter" | "semiannual" | "year";

export const BILLING_CYCLES: BillingCycle[] = ["month", "quarter", "semiannual", "year"];

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semiannual: "Semestral",
  year: "Anual",
};

export const CYCLE_LABEL_PT: Record<BillingCycle, string> = {
  month: "por mês",
  quarter: "por trimestre",
  semiannual: "por semestre",
  year: "por ano",
};

/** Duration of a billing cycle in months. */
export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  month: 1,
  quarter: 3,
  semiannual: 6,
  year: 12,
};

/** Catalog sell period (client) -> persisted cycle (DB). */
export function sellPeriodToCycle(period: string | null | undefined): BillingCycle | null {
  if (period === "monthly" || period === "month") return "month";
  if (period === "quarterly" || period === "quarter") return "quarter";
  if (period === "semiannual" || period === "semiannually") return "semiannual";
  if (period === "annual" || period === "year" || period === "yearly") return "year";
  return null;
}

/** DB period -> cycle (identity for stored values). */
export function toCycle(period: string | null | undefined): BillingCycle | null {
  if (period && (BILLING_CYCLES as string[]).includes(period)) return period as BillingCycle;
  return sellPeriodToCycle(period);
}

/** Months covered by a stored period value (falls back to 1). */
export function cycleMonths(period: string | null | undefined): number {
  const cycle = toCycle(period);
  return cycle ? CYCLE_MONTHS[cycle] : 1;
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === "string" && (BILLING_CYCLES as string[]).includes(value);
}

/** Client-facing subscription shape (billing state incl. lifecycle). */
export type ClientSubscription = {
  id: string;
  kind: string;
  period: string;
  price: number;
  currency: string;
  status: string;
  startsAt: string | null;
  renewsAt: string | null;
  autoRenew: boolean;
  paymentMethod: string | null;
  pastDueSince: string | null;
  suspendedSince: string | null;
  createdAt: string;
};