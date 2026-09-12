import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { adminRecheck, adminDelete } from "@/services/domain.service";

export const dynamic = "force-dynamic";

async function readId(request: NextRequest): Promise<{ id: string } | { response: Response }> {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/domains", e);
    return { response: Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 }) };
  }
  const id = body?.id ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
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

  const result = await adminRecheck(parsed.id, guard.ctx, ip);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, domain: result.domain, source: result.source, message: result.message });
}

export async function DELETE(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.admin");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const parsed = await readId(request);
  if ("response" in parsed) return parsed.response;

  const result = await adminDelete(parsed.id, guard.ctx, ip);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, id: result.id });
}