import { NextRequest } from "next/server";

import { recordAnalyticsEvent, type TrackInput } from "@/lib/analytics";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set<TrackInput["event"]>([
  "pageview",
  "domain_search",
  "signup",
  "cart_add",
  "checkout",
  "purchase",
  "customer",
]);

/** Public, anonymous tracking beacon. Fire-and-forget from the client. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const limited = await applyRateLimit(request, {
    prefix: "analytics-track",
    limit: 120,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: true }, { status: 200 });
  }

  const input = (body ?? {}) as { visitorId?: unknown; event?: unknown; page?: unknown; value?: unknown; meta?: unknown };

  if (typeof input.visitorId !== "string" || !input.visitorId) {
    return Response.json({ ok: true }, { status: 200 });
  }
  if (typeof input.event !== "string" || !ALLOWED_EVENTS.has(input.event as TrackInput["event"])) {
    return Response.json({ ok: true }, { status: 200 });
  }

  const value = typeof input.value === "number" && Number.isFinite(input.value) ? input.value : undefined;

  await recordAnalyticsEvent(input.visitorId, {
    event: input.event as TrackInput["event"],
    page: typeof input.page === "string" ? input.page : undefined,
    value,
    meta: input.meta && typeof input.meta === "object" ? (input.meta as Record<string, unknown>) : undefined,
  });

  return Response.json({ ok: true }, { status: 200 });
}
