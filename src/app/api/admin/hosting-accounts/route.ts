import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { logAudit } from "@/lib/security/audit";
import {
  adminChangePlan,
  adminGetAccount,
  adminListHostingAccounts,
  adminRefreshUsage,
  adminSetAccountStatus,
  adminTriggerProvision,
} from "@/services/hosting-panel.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "admin-hosting-accounts", limit: 90, windowSec: 60 };

type AdminActor = { userId?: string; email?: string };

export async function GET(request: NextRequest) {
  const guard = await requirePermissionRoute("hosting.manage");
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const url = new URL(request.url);
  const hostingId = url.searchParams.get("hostingId");
  if (hostingId) {
    if (!UUID_RE.test(hostingId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
    const result = await adminGetAccount(hostingId);
    return Response.json(result, { status: result.ok ? 200 : result.status });
  }

  const search = url.searchParams.get("search") ?? undefined;
  const result = await adminListHostingAccounts(search);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("hosting.manage");
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "admin-hosting-accounts-action", ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const ip = clientIp(request);
  const actor: AdminActor = { userId: guard.ctx.userId, email: guard.ctx.email };

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const hostingId = typeof body.hostingId === "string" ? body.hostingId : "";
  if (!hostingId || !UUID_RE.test(hostingId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  try {
    switch (action) {
      case "status": {
        const status = typeof body.status === "string" ? body.status : "";
        const reason = typeof body.reason === "string" ? body.reason : undefined;
        const result = await adminSetAccountStatus(hostingId, status, { ...guard.ctx, ...actor } as { userId?: string; email?: string; role: string }, ip, reason);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "plan": {
        const planId = typeof body.planId === "string" ? body.planId : "";
        if (!UUID_RE.test(planId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminChangePlan(hostingId, planId, { ...guard.ctx, ...actor } as { userId?: string; email?: string; role: string }, ip);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "sync": {
        const result = await adminRefreshUsage(hostingId);
        if (result.ok) {
          await logAudit({
            action: "hosting.sync",
            entity: "hosting_account",
            entityId: hostingId,
            actorId: guard.ctx.userId,
            actorEmail: guard.ctx.email,
            actorRole: guard.ctx.role,
            ip,
            meta: { action: "usage" },
          });
        }
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "provision": {
        const result = await adminTriggerProvision(hostingId);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      default:
        return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    serverLogError("api:admin/hosting-accounts", error);
    return Response.json({ ok: false, error: "Erro interno ao processar a conta de alojamento." }, { status: 500 });
  }
}