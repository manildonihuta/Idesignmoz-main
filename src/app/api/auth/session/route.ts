import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const SESSION_LIMIT = 120;
const SESSION_WINDOW_SEC = 60;

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "auth-session",
    limit: SESSION_LIMIT,
    windowSec: SESSION_WINDOW_SEC,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ user: null });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    typeof meta.full_name === "string" && meta.full_name ? meta.full_name : (user.email ?? "");

  return Response.json({ user: { email: user.email, fullName } });
}