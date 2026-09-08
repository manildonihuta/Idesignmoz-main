import { NextRequest } from "next/server";
import { requireRolesRoute } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { STAFF_ROLES } from "@/lib/security/rbac";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

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

  const query = supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", guard.ctx.userId)
    .is("read_at", null);
  const finalQuery = body?.id ? query.eq("id", body.id) : query;

  const { error } = await finalQuery;
  if (error) {
    serverLogError("api:notifications/read", error);
    return Response.json({ ok: false, error: "Não foi possível atualizar." }, { status: 500 });
  }

  return Response.json({ ok: true });
}