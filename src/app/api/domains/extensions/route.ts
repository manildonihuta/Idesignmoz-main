import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration, renewal, ideal_for")
    .eq("active", true)
    .order("registration", { ascending: true });

  if (error || !data) {
    return Response.json({ ok: false, error: "Não foi possível carregar as extensões." }, { status: 500 });
  }

  return Response.json({ ok: true, extensions: data });
}