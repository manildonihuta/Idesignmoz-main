import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminRoute } from "@/lib/admin";

export const dynamic = "force-dynamic";

const ROLES = ["client", "admin"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (guard.response) return guard.response;
  const userId = guard.ctx.userId;

  let body: { id?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const id = body?.id ?? "";
  const role = body?.role ?? "";
  if (!UUID_RE.test(id)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return Response.json({ ok: false, error: "Função inválida." }, { status: 400 });
  }

  // Never allow an admin to demote themselves — it would lock the panel.
  if (id === userId && role !== "admin") {
    return Response.json(
      { ok: false, error: "Não podes remover o teu próprio acesso de administrador." },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return Response.json({ ok: false, error: "Utilizador não encontrado." }, { status: 404 });
  }

  return Response.json({ ok: true, profile: data });
}