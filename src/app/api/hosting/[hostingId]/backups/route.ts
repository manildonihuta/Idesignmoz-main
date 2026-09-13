import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { createBackup, deleteBackup, listBackups, restoreBackup } from "@/services/hosting-panel.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "hosting-backups", limit: 60, windowSec: 60 };

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

  const result = await listBackups(ctx, hostingId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "hosting-backups-action", ip: clientIp(request) });
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
    case "create": {
      const result = await createBackup(ctx, hostingId, {
        label: typeof body.label === "string" ? body.label : undefined,
        kind: typeof body.kind === "string" ? body.kind : undefined,
      });
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "restore": {
      if (!validId(body.backupId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await restoreBackup(ctx, hostingId, body.backupId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "delete": {
      if (!validId(body.backupId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await deleteBackup(ctx, hostingId, body.backupId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    default:
      return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
  }
}