import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import type { SyncService } from "@/lib/providers/sync";
import {
  adminAddCredential,
  adminCredentialExpiryAlerts,
  adminDeleteWebhook,
  adminGetProviderDetail,
  adminInfraOverview,
  adminListActivity,
  adminListCredentials,
  adminListEvents,
  adminListHealthChecks,
  adminListProviders,
  adminListSyncs,
  adminListWebhooks,
  adminRevokeCredential,
  adminRotateCredential,
  adminRunAllHealthChecks,
  adminRunSync,
  adminSaveProvider,
  adminSaveWebhook,
  adminSetProviderStatus,
  adminTestCredential,
  adminTestProviderConnection,
  adminTestWebhook,
} from "@/services/infra.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;
const SYNC_SERVICES: readonly string[] = ["domain", "dns", "hosting", "email", "ssl", "cdn", "backup"];
const LIMIT = { prefix: "admin-infra", limit: 120, windowSec: 60 };

function getActor(guard: { ctx: { userId?: string; email?: string; role: string } }, ip: string) {
  return { userId: guard.ctx.userId, email: guard.ctx.email, role: guard.ctx.role, ip };
}

export async function GET(request: NextRequest) {
  const guard = await requirePermissionRoute("infra.manage");
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "overview";
  const rest = (name: string): string | undefined => url.searchParams.get(name) ?? undefined;

  switch (view) {
    case "providers": {
      const result = await adminListProviders(rest("search"));
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "provider": {
      const slug = url.searchParams.get("slug") ?? "";
      if (!SLUG_RE.test(slug)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await adminGetProviderDetail(slug);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "credentials": {
      const providerId = rest("providerId");
      if (providerId && !UUID_RE.test(providerId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await adminListCredentials(providerId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "syncs": {
      const providerId = rest("providerId");
      if (providerId && !UUID_RE.test(providerId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await adminListSyncs({ providerId, status: rest("status") });
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "webhooks": {
      const providerId = rest("providerId");
      if (providerId && !UUID_RE.test(providerId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await adminListWebhooks(providerId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "activity": {
      const providerId = rest("providerId");
      if (providerId && !UUID_RE.test(providerId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await adminListActivity(providerId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "health": {
      const providerId = rest("providerId");
      if (providerId && !UUID_RE.test(providerId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
      const result = await adminListHealthChecks(providerId);
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    case "events": {
      const result = await adminListEvents(rest("status"));
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
    default: {
      const result = await adminInfraOverview();
      return Response.json(result, { status: result.ok ? 200 : result.status });
    }
  }
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("infra.manage");
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "admin-infra-action", ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const ip = clientIp(request);
  const actor = getActor(guard, ip);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const str = (name: string): string => (typeof body[name] === "string" ? (body[name] as string) : "");
  const action = str("action");

  const requireId = (): string => {
    const id = str("id");
    return UUID_RE.test(id) ? id : "";
  };

  try {
    switch (action) {
      case "provider_save": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const apiEndpoint = body.apiEndpoint === null || typeof body.apiEndpoint === "string" ? body.apiEndpoint : undefined;
        const environment = str("environment") || undefined;
        const result = await adminSaveProvider({ id, name: str("name") || undefined, apiEndpoint, environment }, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "provider_status": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminSetProviderStatus(id, str("status"), actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "provider_test": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminTestProviderConnection(id, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "health_runall": {
        const result = await adminRunAllHealthChecks(actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "credential_add": {
        const providerId = str("providerId");
        if (!UUID_RE.test(providerId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
        const result = await adminAddCredential({ providerId, field: str("field"), value: str("value"), expiresAt }, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "credential_test": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminTestCredential(id, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "credential_rotate": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminRotateCredential(id, str("value"), actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "credential_revoke": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminRevokeCredential(id, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "sync_run": {
        const providerId = str("providerId");
        const service = str("service") as SyncService;
        if (!UUID_RE.test(providerId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        if (!SYNC_SERVICES.includes(service)) return Response.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
        const result = await adminRunSync({ providerId, service }, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "webhook_save": {
        const id = str("id");
        const providerId = str("providerId");
        const events = Array.isArray(body.events) ? body.events.filter((e): e is string => typeof e === "string") : [];
        const generateSecret = body.generateSecret === true;
        const result = await adminSaveWebhook(
          {
            id: id ? id : undefined,
            providerId: providerId || null,
            service: str("service") || "hosting",
            name: str("name"),
            url: str("url"),
            events,
            status: str("status") || undefined,
            secret: str("secret") || undefined,
            generateSecret,
          },
          actor,
        );
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "webhook_delete": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminDeleteWebhook(id, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "webhook_test": {
        const id = requireId();
        if (!id) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminTestWebhook(id, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "credential_expiry_check": {
        const alerted = await adminCredentialExpiryAlerts();
        return Response.json({ ok: true, alerted }, { status: 200 });
      }
      default:
        return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    serverLogError("api:admin/infra", error);
    return Response.json({ ok: false, error: "Erro interno ao processar a infraestrutura de fornecedores." }, { status: 500 });
  }
}