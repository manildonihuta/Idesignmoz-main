import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { adminRegisterByOrder } from "@/services/domain.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.register");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/domains/register", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const orderId = body?.orderId ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const result = await adminRegisterByOrder(orderId, guard.ctx, ip);
  if (!result.ok) {
    if (result.status === 409) {
      return Response.json({ ok: false, mode: "unavailable", error: result.error }, { status: 409 });
    }
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    mode: result.mode,
    tld: result.tld,
    note: result.note,
  });
}