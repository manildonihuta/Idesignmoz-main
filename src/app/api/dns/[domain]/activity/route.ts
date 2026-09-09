import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { dnsListActivity } from "@/services/dns.service";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "dns-activity", limit: 40, windowSec: 60 };

type Context = { params: Promise<{ domain: string }> };

export async function GET(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { domain } = await context.params;
  const result = await dnsListActivity(ctx, domain);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}