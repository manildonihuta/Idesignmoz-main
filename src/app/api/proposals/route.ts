import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { listSummary, saveDraft } from "@/services/proposal.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermissionRoute("proposals.view");
  if (guard.response) return guard.response;

  const result = await listSummary();
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, proposals: result.proposals });
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("proposals.manage");
  if (guard.response) return guard.response;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "proposals",
    limit: 30,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:proposals", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await saveDraft(body ?? {}, guard.ctx, ip);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, proposal: result.proposal, id: result.id });
}