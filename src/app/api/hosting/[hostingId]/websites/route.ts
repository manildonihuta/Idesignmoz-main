import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import {
  createWebsite,
  deleteWebsite,
  listWebsites,
  setWebsitePhp,
  updateWebsite,
} from "@/services/hosting-panel.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "hosting-websites", limit: 60, windowSec: 60 };

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

  const result = await listWebsites(ctx, hostingId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "hosting-websites-action", ip: clientIp(request) });
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
      const result = await createWebsite(ctx, hostingId, {
        domain: typeof body.domain === "string" ? body.domain : "",
        app: typeof body.app === "string" ? body.app : undefined,
        phpVersion: typeof body.phpVersion === "string" ? body.phpVersion : undefined,
        documentRoot: typeof body.documentRoot === "string" ? body.documentRoot : undefined,
        storageMb: typeof body.storageMb === "number" ? body.storageMb : undefined,
      });
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "update": {
      if (!validId(body.websiteId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const patchBody = (body.patch ?? {}) as Record<string, unknown>;
      const result = await updateWebsite(ctx, hostingId, body.websiteId, {
        app: typeof patchBody.app === "string" ? patchBody.app : undefined,
        status: typeof patchBody.status === "string" ? patchBody.status : undefined,
        documentRoot: typeof patchBody.documentRoot === "string" ? patchBody.documentRoot : undefined,
        storageMb: typeof patchBody.storageMb === "number" ? patchBody.storageMb : undefined,
      });
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "delete": {
      if (!validId(body.websiteId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await deleteWebsite(ctx, hostingId, body.websiteId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "php": {
      if (!validId(body.websiteId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await setWebsitePhp(ctx, hostingId, body.websiteId, typeof body.phpVersion === "string" ? body.phpVersion : "");
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    default:
      return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
  }
}