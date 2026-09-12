import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { setMessageStatus, deleteMessage } from "@/services/crm.service";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";

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
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const raw = body as { id?: unknown; status?: unknown };
  const result = await setMessageStatus(
    String(raw.id ?? ""),
    String(raw.status ?? ""),
    guard.ctx,
    ip,
  );
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  return Response.json({ ok: true, message: result.message });
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
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const id = String((body as { id?: unknown })?.id ?? "");
  const result = await deleteMessage(id, guard.ctx, ip);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  return Response.json({ ok: true, id: result.id });
}