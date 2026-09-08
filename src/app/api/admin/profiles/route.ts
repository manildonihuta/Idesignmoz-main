import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { profileRoleSchema } from "@/lib/schemas";
import { normalizeRole, ROLE_LABEL } from "@/lib/security/rbac";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const guard = await requirePermissionRoute("profiles.manage");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const userId = guard.ctx.userId;
  const actorRole = guard.ctx.role;

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/profiles", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = profileRoleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Função inválida." }, { status: 400 });
  }
  const { id, role } = parsed.data;
  const normalizedRole = normalizeRole(role);

  // Only super admins may grant or revoke super_admin.
  if (normalizedRole === "super_admin" && actorRole !== "super_admin") {
    return Response.json({ ok: false, error: "Apenas um Super Admin pode atribuir este acesso." }, { status: 403 });
  }

  // Never allow an admin to demote themselves — it would lock the panel.
  if (id === userId && normalizedRole !== "super_admin" && normalizedRole !== actorRole) {
    return Response.json(
      { ok: false, error: "Não podes remover o teu próprio acesso administrativo." },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role: normalizedRole })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return Response.json({ ok: false, error: "Utilizador não encontrado." }, { status: 404 });
  }

  await logAudit({
    action: AUDIT.PROFILE_ROLE,
    entity: "profile",
    entityId: id,
    actorId: userId,
    actorEmail: guard.ctx.email,
    actorRole,
    ip,
    meta: { role: normalizedRole, label: ROLE_LABEL[normalizedRole] },
  });

  return Response.json({ ok: true, profile: data });
}