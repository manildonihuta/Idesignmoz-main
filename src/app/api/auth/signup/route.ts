import { NextRequest } from "next/server";
import { signupSchema } from "@/lib/schemas";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_SEC = 300;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "auth-signup",
    limit: SIGNUP_LIMIT,
    windowSec: SIGNUP_WINDOW_SEC,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:auth/signup", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Campos inválidos." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, company: parsed.data.company || null },
      emailRedirectTo: request.nextUrl.origin,
    },
  });

  if (error) {
    serverLogError("api:auth/signup", error);
    return Response.json(
      {
        ok: false,
        error: error.message.includes("already registered")
          ? "Já existe uma conta com este email."
          : "Não foi possível criar a conta.",
      },
      { status: error.message.includes("already registered") ? 409 : 500 },
    );
  }

  const visitorId =
    request.cookies.get("idm_vid")?.value?.slice(0, 128) ?? "";

  if (visitorId) {
    await recordAnalyticsEvent(visitorId, { event: "signup" });
  }

  return Response.json({ ok: true, session: Boolean(data.session) });
}