import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminRoute } from "@/lib/admin";
import { checkDomainAvailability } from "@/lib/domain-provider";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readId(request: NextRequest): Promise<{ id: string } | { response: Response }> {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return { response: Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 }) };
  }
  const id = body?.id ?? "";
  if (!UUID_RE.test(id)) {
    return { response: Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 }) };
  }
  return { id };
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (guard.response) return guard.response;

  const parsed = await readId(request);
  if ("response" in parsed) return parsed.response;

  const { data: domain, error } = await supabaseAdmin
    .from("domains")
    .select("*")
    .eq("id", parsed.id)
    .maybeSingle();

  if (error || !domain) {
    return Response.json({ ok: false, error: "Domínio não encontrado." }, { status: 404 });
  }

  // Re-check real availability (RDAP by default, Namecheap when configured).
  const check = await checkDomainAvailability(domain.full_domain);
  const nextStatus =
    domain.status === "reserved" ? "reserved" : check.available ? "available" : "registered";

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("domains")
    .update({ status: nextStatus, checked_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .select()
    .single();

  if (updateError || !updated) {
    return Response.json({ ok: false, error: "Não foi possível atualizar o domínio." }, { status: 500 });
  }

  return Response.json({ ok: true, domain: updated, source: check.source, message: check.message });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (guard.response) return guard.response;

  const parsed = await readId(request);
  if ("response" in parsed) return parsed.response;

  const { error } = await supabaseAdmin.from("domains").delete().eq("id", parsed.id);

  if (error) {
    return Response.json({ ok: false, error: "Não foi possível eliminar." }, { status: 500 });
  }

  return Response.json({ ok: true, id: parsed.id });
}