import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { orderStatusSchema, uuidSchema } from "@/lib/schemas";
import { serverLogError } from "@/lib/server-log";
import { setOrderStatus, deleteOrder } from "@/services/domain.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const guard = await requirePermissionRoute("orders.manage");
  if (guard.response) return guard.response;

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

  const result = await setOrderStatus(parsed.data.id, parsed.data.status, guard.ctx, ip);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true, order: result.order });
}

export async function DELETE(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const guard = await requirePermissionRoute("orders.manage");
  if (guard.response) return guard.response;

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

  const result = await deleteOrder(String(raw), guard.ctx, ip);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true, id: result.id });
}