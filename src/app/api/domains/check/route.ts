import { NextRequest } from "next/server";

import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { checkAvailability } from "@/services/domain.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "domain-check",
    limit: 90,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const searchParams = request.nextUrl.searchParams;
  const result = await checkAvailability(
    searchParams.get("name") ?? "",
    searchParams.get("extension") ?? "",
  );
  if (!result.ok) {
    return Response.json({ available: false, error: result.error }, { status: result.status });
  }

  return Response.json({
    available: result.available,
    fullDomain: result.fullDomain,
    name: result.name,
    extension: result.extension,
    status: result.status,
    price: result.price ?? null,
    renewal: result.renewal ?? null,
    source: result.source,
    error: result.error,
  });
}