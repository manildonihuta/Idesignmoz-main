import { NextRequest } from "next/server";

import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { getByToken, decide } from "@/services/proposal.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 100) {
    return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
  }

  const limited = await applyRateLimit(request, {
    prefix: `proposal:${token.slice(0, 16)}`,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const result = await getByToken(token);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, proposal: result.proposal });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 100) {
    return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
  }

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: `proposal-action:${token.slice(0, 16)}`,
    limit: 5,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:proposals/[token]", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await decide(token, body ?? {}, ip);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, proposal: result.proposal });
}