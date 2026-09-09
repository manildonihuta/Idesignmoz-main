import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { dnsUpdateRecord, dnsDeleteRecord } from "@/services/dns.service";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "dns-record", limit: 40, windowSec: 60 };

type Context = { params: Promise<{ domain: string; recordId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { domain, recordId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await dnsUpdateRecord(ctx, domain, recordId, body);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function DELETE(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { domain, recordId } = await context.params;
  const result = await dnsDeleteRecord(ctx, domain, recordId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}