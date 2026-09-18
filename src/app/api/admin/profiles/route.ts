import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { updateProfileRole } from "@/services/crm.service";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const guard = await requirePermissionRoute("profiles.manage");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const raw = body as { id?: unknown; role?: unknown };
  const result = await updateProfileRole(
    String(raw.id ?? ""),
    String(raw.role ?? ""),
    guard.ctx,
    ip,
  );
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  return Response.json({ ok: true, profile: result.profile });
}