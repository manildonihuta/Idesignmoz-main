import { NextRequest } from "next/server";
import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { clientListDomains, clientUpdateDomain } from "@/services/domain.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, {
    prefix: "client-domains",
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const ctx = guard.ctx!;

  const domains = await clientListDomains(ctx);
  return Response.json({ ok: true, domains });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "client-domains-update",
    limit: 20,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: {
    fullDomain?: string;
    update?: Record<string, unknown>;
    action?: "renew" | "requestTransfer";
    extraYears?: number;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await clientUpdateDomain(ctx, {
    fullDomain: body.fullDomain,
    update: body.update,
    action: body.action,
    extraYears: body.extraYears,
  }, ip);

  return Response.json(result, { status: result.ok ? 200 : result.status });
}