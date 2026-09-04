import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; fullDomain?: string; extension?: string; price?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const fullDomain = body.fullDomain?.trim().toLowerCase() ?? "";
  const extension = body.extension?.trim() ?? "";
  const price = Number(body.price);

  if (!name || !email || !EMAIL_RE.test(email) || !fullDomain || !extension || !Number.isFinite(price) || price <= 0) {
    return Response.json({ ok: false, error: "Preencha todos os campos correctamente." }, { status: 400 });
  }

  const { data: ext } = await supabaseAdmin
    .from("domain_extensions")
    .select("registration")
    .eq("extension", extension)
    .maybeSingle();

  if (!ext) {
    return Response.json({ ok: false, error: "Extensão de domínio não suportada." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("domain_orders")
    .insert({ full_domain: fullDomain, extension, name, email, price })
    .select()
    .single();

  if (error) {
    return Response.json({ ok: false, error: "Não foi possível registar o pedido." }, { status: 500 });
  }

  return Response.json({ ok: true, order: data });
}

