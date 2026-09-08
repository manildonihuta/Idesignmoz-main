import { NextRequest, NextResponse } from "next/server";

import { searchAll, searchDomains, searchPosts, searchProjects } from "@/lib/search";
import { searchQuerySchema } from "@/lib/schemas";
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
  const parsed = searchQuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    type: searchParams.get("type") ?? "all",
    limit: searchParams.get("limit") ?? "10",
  });
  if (!parsed.success || parsed.data.limit < 1) {
    return NextResponse.json({ hits: [] });
  }

  const { q, type, limit } = parsed.data;
  const trimmed = q.trim();
  if (!trimmed) {
    return NextResponse.json({ hits: [] });
  }

  const hits =
    type === "domain"
      ? await searchDomains(trimmed, limit)
      : type === "post"
        ? await searchPosts(trimmed, limit)
        : type === "project"
          ? await searchProjects(trimmed, limit)
          : await searchAll(trimmed, limit);

  return NextResponse.json({ hits });
}