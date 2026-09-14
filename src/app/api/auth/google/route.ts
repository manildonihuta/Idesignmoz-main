import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const GOOGLE_LIMIT = 15;
const GOOGLE_WINDOW_SEC = 60;

export async function GET(request: NextRequest) {
  const ip = clientIp(request);

  const limited = await applyRateLimit(request, {
    prefix: "auth-google",
    limit: GOOGLE_LIMIT,
    windowSec: GOOGLE_WINDOW_SEC,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const origin = request.nextUrl.origin;
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const redirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    serverLogError("api:auth/google", error ?? new Error("OAuth URL em falta."));
    return Response.json({ ok: false, error: "Não foi possível iniciar sessão com o Google." }, { status: 500 });
  }

  return Response.json({ ok: true, url: data.url });
}