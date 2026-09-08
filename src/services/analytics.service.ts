import "server-only";

import {
  recordAnalyticsEvent,
  getAnalyticsReport,
  type AnalyticsReport,
  type PeriodDays,
  type TrackInput,
} from "@/lib/analytics";
import { fail, type ServiceResult } from "./result";

const ALLOWED_EVENTS = new Set<TrackInput["event"]>([
  "pageview",
  "domain_search",
  "signup",
  "cart_add",
  "checkout",
  "purchase",
  "customer",
]);

export type TrackInputRaw = {
  visitorId?: unknown;
  event?: unknown;
  page?: unknown;
  value?: unknown;
  meta?: unknown;
};

/**
 * Public, anonymous tracking beacon (fire-and-forget). Sanitizes input and
 * always succeeds silently — analytics must never break the hot path.
 */
export async function track(input: TrackInputRaw): Promise<{ ok: true }> {
  if (typeof input.visitorId !== "string" || !input.visitorId) return { ok: true };
  if (typeof input.event !== "string" || !ALLOWED_EVENTS.has(input.event as TrackInput["event"])) {
    return { ok: true };
  }

  const value = typeof input.value === "number" && Number.isFinite(input.value) ? input.value : undefined;

  await recordAnalyticsEvent(input.visitorId, {
    event: input.event as TrackInput["event"],
    page: typeof input.page === "string" ? input.page : undefined,
    value,
    meta: input.meta && typeof input.meta === "object" ? (input.meta as Record<string, unknown>) : undefined,
  });

  return { ok: true };
}

export function isPeriodDays(value: unknown): value is PeriodDays {
  return value === 7 || value === 30 || value === 90;
}

export async function report(days: PeriodDays): Promise<ServiceResult<AnalyticsReport>> {
  try {
    return { ok: true, ...(await getAnalyticsReport(days)) };
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
  }
}