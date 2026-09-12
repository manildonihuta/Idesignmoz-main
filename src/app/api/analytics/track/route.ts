import { NextRequest } from "next/server";

import { track } from "@/services/analytics.service";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

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

  await track((body ?? {}) as Record<string, unknown>);

  return Response.json({ ok: true }, { status: 200 });
}