import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { registerWithProvider } from "@/services/domain.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.register");
  if (guard.response) return guard.response;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "domain-register",
    limit: 15,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:domains/register", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await registerWithProvider(body ?? {});
  if (!result.ok) {
    if (result.status === 501) {
      return Response.json({ ok: false, error: result.error, configured: false }, { status: 501 });
    }
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true, tld: result.tld });
}