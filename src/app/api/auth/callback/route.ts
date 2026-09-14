import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const loginError = `${origin}/login?error=oauth`;

  if (!code) {
    return Response.redirect(loginError, 302);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    serverLogError("api:auth/callback", error ?? new Error("Sessão OAuth em falta."));
    return Response.redirect(loginError, 302);
  }

  const user = data.session.user;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = (meta.full_name as string) || (meta.name as string) || "";

  if (fullName) {
    await supabase.auth.updateUser({ data: { ...meta, full_name: fullName } }).catch(() => undefined);

    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && !profile.full_name) {
        await supabaseAdmin.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      }
    } catch {
      // Best-effort: falhar o login não deve quebrar a sessão criada.
    }
  }

  return Response.redirect(`${origin}${next}`, 302);
}