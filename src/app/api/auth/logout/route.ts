import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const LOGOUT_LIMIT = 30;
const LOGOUT_WINDOW_SEC = 60;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "auth-logout",
    limit: LOGOUT_LIMIT,
    windowSec: LOGOUT_WINDOW_SEC,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    serverLogError("api:auth/logout", error);
    return Response.json({ ok: false, error: "Não foi possível terminar a sessão." }, { status: 500 });
  }

  return Response.json({ ok: true });
}