import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SERVICES = ["Design de website", "Identidade de marca", "Alojamento", "Outra necessidade"];

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; service?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const service = body.service?.trim() || "Outra necessidade";
  const message = body.message?.trim() ?? "";

  if (!name || !EMAIL_RE.test(email) || !message) {
    return Response.json({ ok: false, error: "Preencha nome, email e mensagem." }, { status: 400 });
  }
  if (!SERVICES.includes(service)) {
    return Response.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .insert({ name, email, service, message })
    .select()
    .single();

  if (error) {
    return Response.json({ ok: false, error: "Não foi possível enviar o pedido." }, { status: 500 });
  }

  return Response.json({ ok: true, message: data });
}
