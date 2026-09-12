import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { getAdminStore, putAdminStore } from "@/services/admin-store.service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ kind: string }> };

/** Staff-only (settings.manage). Reads one admin/CRM store from the DB. */
export async function GET(request: NextRequest, context: Context) {
  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, {
    prefix: "admin-store",
    limit: 120,
    windowSec: 60,
    ip: clientIp(request),
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { kind } = await context.params;
  const result = await getAdminStore(kind);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, value: result.value, found: result.found });
}

/** Staff-only (settings.manage). Replaces one admin/CRM store in the DB. */
export async function PUT(request: NextRequest, context: Context) {
  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "admin-store",
    limit: 120,
    windowSec: 60,
    ip: clientIp(request),
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { kind } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/store", e);
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const result = await putAdminStore(kind, (body as { value?: unknown } | undefined)?.value, guard.ctx, clientIp(request));
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}