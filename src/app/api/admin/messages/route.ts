import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { messageStatusSchema, uuidSchema } from "@/lib/schemas";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const guard = await requirePermissionRoute("messages.manage");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/messages", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = messageStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const { id, status } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ ok: false, error: "Mensagem não encontrada." }, { status: 404 });
  }

  await logAudit({
    action: AUDIT.MESSAGE_STATUS,
    entity: "contact_message",
    entityId: id,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta: { status },
  });

  return Response.json({ ok: true, message: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await requirePermissionRoute("messages.manage");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/messages", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const raw = (body as { id?: unknown })?.id;
  if (!uuidSchema.safeParse(raw).success) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }
  const id = String(raw);

  const { error } = await supabaseAdmin.from("contact_messages").delete().eq("id", id);

  if (error) {
    serverLogError("api:admin/messages", error);
    return Response.json({ ok: false, error: "Não foi possível eliminar." }, { status: 500 });
  }

  await logAudit({
    action: AUDIT.MESSAGE_DELETED,
    entity: "contact_message",
    entityId: id,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
  });

  return Response.json({ ok: true, id });
}