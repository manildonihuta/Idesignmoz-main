import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import {
  adminGetEmailService,
  adminListEmailServices,
  adminSetEmailServiceStatus,
  adminSyncEmailUsage,
  type AdminActor,
} from "@/services/email-admin.service";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "admin-email", limit: 90, windowSec: 60 };

export async function GET(request: NextRequest) {
  const guard = await requirePermissionRoute("email.manage");
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const url = new URL(request.url);
  const serviceId = url.searchParams.get("serviceId");
  if (serviceId) {
    const result = await adminGetEmailService(serviceId);
    return Response.json(result, { status: result.ok ? 200 : result.status });
  }

  const search = url.searchParams.get("search") ?? undefined;
  const result = await adminListEmailServices(search);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("email.manage");
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "admin-email-action", ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const ip = clientIp(request);
  const actor: AdminActor = { userId: guard.ctx.userId, email: guard.ctx.email, role: guard.ctx.role };

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  if (!serviceId) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  try {
    switch (action) {
      case "status": {
        const status = typeof body.status === "string" ? body.status : "";
        const reason = typeof body.reason === "string" ? body.reason : undefined;
        if (status !== "suspend" && status !== "resume") {
          return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
        }
        const result = await adminSetEmailServiceStatus(serviceId, status, actor, ip, reason);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "sync": {
        const result = await adminSyncEmailUsage(serviceId, actor, ip);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      default:
        return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    serverLogError("api:admin/email", error);
    return Response.json({ ok: false, error: "Erro interno ao processar o serviço de email." }, { status: 500 });
  }
}