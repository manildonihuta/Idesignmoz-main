import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { createCron, deleteCron, listCron, updateCron } from "@/services/hosting-panel.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "hosting-advanced", limit: 60, windowSec: 60 };

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

  const result = await listCron(ctx, hostingId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "hosting-advanced-action", ip: clientIp(request) });
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
    case "cron_create": {
      const result = await createCron(ctx, hostingId, {
        command: typeof body.command === "string" ? body.command : "",
        schedule: typeof body.schedule === "string" ? body.schedule : "",
      });
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "cron_update": {
      if (!validId(body.jobId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const patch = (body.patch ?? {}) as Record<string, unknown>;
      const result = await updateCron(ctx, hostingId, body.jobId, {
        command: typeof patch.command === "string" ? patch.command : undefined,
        schedule: typeof patch.schedule === "string" ? patch.schedule : undefined,
        status: typeof patch.status === "string" ? patch.status : undefined,
      });
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "cron_delete": {
      if (!validId(body.jobId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await deleteCron(ctx, hostingId, body.jobId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    default:
      return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
  }
}