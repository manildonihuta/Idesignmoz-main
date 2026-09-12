import { NextRequest } from "next/server";

import { requireRolesRoute } from "@/lib/admin";
import { STAFF_ROLES } from "@/lib/security/rbac";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { markRead } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireRolesRoute(STAFF_ROLES);
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "notifications:read",
    limit: 60,
    windowSec: 60,
    ip: clientIp(request),
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: { id?: string } = {};
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:notifications/read", e);
    body = {};
  }

  const result = await markRead(guard.ctx, body?.id);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true });
}