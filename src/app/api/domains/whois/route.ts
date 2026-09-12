import { NextRequest } from "next/server";

import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { whois } from "@/services/domain.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "whois",
    limit: 20,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const result = await whois(request.nextUrl.searchParams.get("domain") ?? "");
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true, whois: result.whois });
}