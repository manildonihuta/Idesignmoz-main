import { NextRequest, NextResponse } from "next/server";

import { search } from "@/services/search.service";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "search",
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { searchParams } = new URL(request.url);
  const result = await search({
    q: searchParams.get("q") ?? "",
    type: searchParams.get("type") ?? "all",
    limit: Number(searchParams.get("limit") ?? "10"),
  });

  if (!result.ok) return NextResponse.json({ hits: [] });

  return NextResponse.json({ hits: result.hits });
}