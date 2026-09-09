import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { dnsSetDnssec } from "@/services/dns.service";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "dns-dnssec", limit: 10, windowSec: 60 };

type Context = { params: Promise<{ domain: string }> };

export async function POST(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { domain } = await context.params;

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await dnsSetDnssec(ctx, domain, body.enabled === true);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}