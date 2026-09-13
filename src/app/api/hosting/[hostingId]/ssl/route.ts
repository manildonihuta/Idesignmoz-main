import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { installSsl, listSsl, removeSsl, renewSsl } from "@/services/hosting-panel.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "hosting-ssl", limit: 60, windowSec: 60 };

type Context = { params: Promise<{ hostingId: string }> };

function validId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

export async function GET(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { hostingId } = await context.params;
  if (!validId(hostingId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });

  const result = await listSsl(ctx, hostingId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "hosting-ssl-action", ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { hostingId } = await context.params;
  if (!validId(hostingId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  switch (action) {
    case "install": {
      const result = await installSsl(ctx, hostingId, {
        domain: typeof body.domain === "string" ? body.domain : "",
        provider: typeof body.provider === "string" ? body.provider : undefined,
      });
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "renew": {
      if (!validId(body.certificateId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await renewSsl(ctx, hostingId, body.certificateId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "remove": {
      if (!validId(body.certificateId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await removeSsl(ctx, hostingId, body.certificateId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    default:
      return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
  }
}