import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { clientAction, type ClientProjectActionInput } from "@/services/project.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "client-projects",
    limit: 20,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: ClientProjectActionInput;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:client/projects", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await clientAction(ctx, body ?? {}, ip);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}