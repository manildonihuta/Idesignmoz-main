import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requirePermissionRoute } from "@/lib/admin";
import { checkDomainAvailability } from "@/lib/domain-provider";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readId(request: NextRequest): Promise<{ id: string } | { response: Response }> {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/domains", e);
    return { response: Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 }) };
  }
  const id = body?.id ?? "";
  if (!UUID_RE.test(id)) {
    return { response: Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 }) };
  }
  return { id };
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.admin");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const parsed = await readId(request);
  if ("response" in parsed) return parsed.response;

  const { data: domain, error } = await supabaseAdmin
    .from("domains")
    .select("*")
    .eq("id", parsed.id)
    .maybeSingle();

  if (error || !domain) {
    return Response.json({ ok: false, error: "Domínio não encontrado." }, { status: 404 });
  }

  // Re-check real availability (RDAP by default, Namecheap when configured).
  const check = await checkDomainAvailability(domain.full_domain);
  const nextStatus =
    domain.status === "reserved" ? "reserved" : check.available ? "available" : "registered";

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("domains")
    .update({ status: nextStatus, checked_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .select()
    .single();

  if (updateError || !updated) {
    serverLogError("api:admin/domains", updateError ?? new Error("domain update returned null"));
    return Response.json({ ok: false, error: "Não foi possível atualizar o domínio." }, { status: 500 });
  }

  await logAudit({
    action: AUDIT.DOMAIN_RECHECKED,
    entity: "domain",
    entityId: parsed.id,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta: { fullDomain: domain.full_domain, status: nextStatus, source: check.source },
  });

  return Response.json({ ok: true, domain: updated, source: check.source, message: check.message });
}

export async function DELETE(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.admin");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const parsed = await readId(request);
  if ("response" in parsed) return parsed.response;

  const { data: deleted, error } = await supabaseAdmin.from("domains").delete().eq("id", parsed.id).select("full_domain").single();

  if (error) {
    serverLogError("api:admin/domains", error);
    return Response.json({ ok: false, error: "Não foi possível eliminar." }, { status: 500 });
  }

  await logAudit({
    action: AUDIT.DOMAIN_DELETED,
    entity: "domain",
    entityId: parsed.id,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta: { fullDomain: deleted?.full_domain },
  });

  return Response.json({ ok: true, id: parsed.id });
}