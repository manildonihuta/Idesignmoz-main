import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { orderStatusSchema, uuidSchema } from "@/lib/schemas";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const guard = await requirePermissionRoute("orders.manage");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/orders", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const { id, status } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("domain_orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
  }

  await logAudit({
    action: AUDIT.ORDER_STATUS,
    entity: "domain_order",
    entityId: id,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta: { status },
  });

  if (status === "paid") {
    await notifyEvent(
      "payment.successful",
      { fullDomain: data.full_domain, price: data.price },
      { recipients: data.email ? [{ email: data.email, name: data.name }] : [] },
    );
  }

  return Response.json({ ok: true, order: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await requirePermissionRoute("orders.manage");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/orders", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const raw = (body as { id?: unknown })?.id;
  if (!uuidSchema.safeParse(raw).success) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }
  const id = String(raw);

  const { error } = await supabaseAdmin.from("domain_orders").delete().eq("id", id);

  if (error) {
    serverLogError("api:admin/orders", error);
    return Response.json({ ok: false, error: "Não foi possível eliminar." }, { status: 500 });
  }

  await logAudit({
    action: AUDIT.ORDER_DELETED,
    entity: "domain_order",
    entityId: id,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
  });

  return Response.json({ ok: true, id });
}