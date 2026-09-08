import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_SEC = 300;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "auth-login",
    limit: LOGIN_LIMIT,
    windowSec: LOGIN_WINDOW_SEC,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:auth/login", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Campos inválidos." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return Response.json({ ok: false, error: "Email ou palavra-passe incorrectos." }, { status: 401 });
  }

  return Response.json({ ok: true });
}