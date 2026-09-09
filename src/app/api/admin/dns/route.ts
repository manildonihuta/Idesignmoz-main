import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";
import {
  adminDnsCheckPropagation,
  adminDnsCreateZone,
  adminDnsDeleteRecord,
  adminDnsDeleteZone,
  adminDnsGetBundle,
  adminDnsListZones,
  adminDnsSetDnssec,
  adminDnsSyncZone,
  adminDnsUpdateNameservers,
  adminDnsUpsertRecord,
} from "@/services/dns.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminActor = { userId?: string; email?: string };

async function applyAudit(
  action: string,
  entityId: string | undefined,
  guard: { ctx: { userId?: string; email?: string; role: string } },
  ip: string,
  meta?: Record<string, unknown>,
) {
  await logAudit({
    action,
    entity: "dns",
    entityId,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta,
  });
}

export async function GET(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.admin");
  if (guard.response) return guard.response;

  const url = new URL(request.url);
  const zoneId = url.searchParams.get("zoneId");
  if (zoneId) {
    if (!UUID_RE.test(zoneId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
    const result = await adminDnsGetBundle(zoneId);
    return Response.json(result, { status: result.ok ? 200 : result.status });
  }

  const result = await adminDnsListZones();
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.admin");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const actor: AdminActor = { userId: guard.ctx.userId, email: guard.ctx.email };

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const zoneId = typeof body.zoneId === "string" ? body.zoneId : "";
  const recordId = typeof body.recordId === "string" ? body.recordId : undefined;

  try {
    switch (action) {
      case "zone_create": {
        const fullDomain = typeof body.fullDomain === "string" ? body.fullDomain : "";
        if (!fullDomain) return Response.json({ ok: false, error: "Indique o domínio." }, { status: 400 });
        const result = await adminDnsCreateZone(fullDomain, actor);
        if (result.ok) {
          await applyAudit(AUDIT.DNS_ZONE_CREATED, result.bundle.zone.id, guard, ip, { fullDomain });
        }
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "zone_delete": {
        if (!zoneId || !UUID_RE.test(zoneId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminDnsDeleteZone(zoneId);
        if (result.ok) await applyAudit(AUDIT.DNS_ZONE_DELETED, zoneId, guard, ip);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "zone_sync": {
        if (!zoneId || !UUID_RE.test(zoneId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminDnsSyncZone(zoneId, actor);
        if (result.ok) await applyAudit(AUDIT.DNS_ZONE_SYNCED, zoneId, guard, ip);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "record_create":
      case "record_update": {
        if (!zoneId || !UUID_RE.test(zoneId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminDnsUpsertRecord(action === "record_create" ? "create" : "update", zoneId, recordId, body.record, actor);
        if (result.ok) {
          await applyAudit(action === "record_create" ? AUDIT.DNS_RECORD_CREATED : AUDIT.DNS_RECORD_UPDATED, zoneId, guard, ip, {
            recordId: recordId ?? undefined,
          });
        }
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "record_delete": {
        if (!zoneId || !UUID_RE.test(zoneId) || !recordId || !UUID_RE.test(recordId)) {
          return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        }
        const result = await adminDnsDeleteRecord(zoneId, recordId, actor);
        if (result.ok) await applyAudit(AUDIT.DNS_RECORD_DELETED, zoneId, guard, ip, { recordId });
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "nameservers": {
        if (!zoneId || !UUID_RE.test(zoneId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminDnsUpdateNameservers(zoneId, body.nameservers, actor);
        if (result.ok) await applyAudit(AUDIT.DNS_NAMESERVERS_UPDATED, zoneId, guard, ip);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "dnssec": {
        if (!zoneId || !UUID_RE.test(zoneId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const enabled = body.enabled === true;
        const result = await adminDnsSetDnssec(zoneId, enabled, actor);
        if (result.ok) await applyAudit(AUDIT.DNS_DNSSEC, zoneId, guard, ip, { enabled });
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "propagation": {
        if (!zoneId || !UUID_RE.test(zoneId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
        const result = await adminDnsCheckPropagation(zoneId, actor);
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      default:
        return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    serverLogError("api:admin/dns", error);
    return Response.json({ ok: false, error: "Erro interno ao processar o DNS." }, { status: 500 });
  }
}