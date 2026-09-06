import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminRoute } from "@/lib/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "in_progress", "done"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (guard.response) return guard.response;

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const id = body?.id ?? "";
  const status = body?.status ?? "";
  if (!UUID_RE.test(id)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return Response.json({ ok: false, error: "Estado inválido." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ ok: false, error: "Mensagem não encontrada." }, { status: 404 });
  }

  return Response.json({ ok: true, message: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (guard.response) return guard.response;

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const id = body?.id ?? "";
  if (!UUID_RE.test(id)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("contact_messages").delete().eq("id", id);

  if (error) {
    return Response.json({ ok: false, error: "Não foi possível eliminar." }, { status: 500 });
  }

  return Response.json({ ok: true, id });
}