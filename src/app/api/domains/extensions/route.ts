import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "extensions",
    limit: 90,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { data, error } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration, renewal, ideal_for")
    .eq("active", true)
    .order("registration", { ascending: true });

  if (error || !data) {
    serverLogError("api:domains/extensions", error ?? new Error("extensions query returned null"));
    return Response.json({ ok: false, error: "Não foi possível carregar as extensões." }, { status: 500 });
  }

  return Response.json({ ok: true, extensions: data });
}