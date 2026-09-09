import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { dnsGetBundle } from "@/services/dns.service";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "dns-bundle", limit: 60, windowSec: 60 };

type Context = { params: Promise<{ domain: string }> };

export async function GET(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { domain } = await context.params;
  const result = await dnsGetBundle(ctx, domain);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "dns-ensure" });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { domain } = await context.params;
  const result = await dnsGetBundle(ctx, domain);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}