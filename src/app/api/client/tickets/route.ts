import { NextRequest } from "next/server";
import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { list, create, reply } from "@/services/ticket.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, {
    prefix: "client-tickets",
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const result = await list(guard.ctx!);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "client-tickets-create",
    limit: 10,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await create(ctx, body, ip);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "client-tickets-reply",
    limit: 20,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await reply(ctx, body, ip);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}