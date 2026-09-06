import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkDomainAvailability } from "@/lib/domain-provider";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeDomainName(raw: string): string | null {
  const name = raw.toLowerCase().replace(/\s+/g, "").trim();
  if (!name || name.length < 2 || name.length > 63) return null;
  if (!/^[a-z0-9-]+$/.test(name)) return null;
  if (name.startsWith("-") || name.endsWith("-")) return null;
  return name;
}

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; fullDomain?: string; extension?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const contactName = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const fullDomain = body.fullDomain?.trim().toLowerCase() ?? "";
  const extension = body.extension?.trim().toLowerCase() ?? "";

  if (!contactName || !email || !EMAIL_RE.test(email) || !fullDomain) {
    return Response.json({ ok: false, error: "Preencha todos os campos correctamente." }, { status: 400 });
  }

  const { data: ext } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration")
    .eq("extension", extension)
    .eq("active", true)
    .maybeSingle();

  if (!ext) {
    return Response.json({ ok: false, error: "Extensão de domínio não suportada." }, { status: 400 });
  }

  // Derive the domain's name part from fullDomain and make sure it is well-formed.
  const domainName = extension && fullDomain.endsWith(extension) ? fullDomain.slice(0, -extension.length) : null;
  if (!sanitizeDomainName(domainName ?? "")) {
    return Response.json({ ok: false, error: "Nome de domínio inválido." }, { status: 400 });
  }

  // Re-verify availability before accepting the order so taken domains can't be ordered.
  const { data: existing } = await supabaseAdmin
    .from("domains")
    .select("status")
    .eq("full_domain", fullDomain)
    .maybeSingle();

  const locallyTaken = existing?.status === "registered" || existing?.status === "reserved";
  const check = locallyTaken ? { available: false } : await checkDomainAvailability(fullDomain);

  if (!check.available) {
    return Response.json({ ok: false, error: "Este domínio já não está disponível para registo." }, { status: 409 });
  }

  // Price is authoritative from the database, never from the client.
  const price = ext.registration;

  const { data, error } = await supabaseAdmin
    .from("domain_orders")
    .insert({ full_domain: fullDomain, extension, name: contactName, email, price })
    .select()
    .single();

  if (error) {
    return Response.json({ ok: false, error: "Não foi possível registar o pedido." }, { status: 500 });
  }

  // Reserve the domain locally so it can't be ordered again while this order is open.
  await supabaseAdmin.from("domains").upsert(
    { name: domainName, extension, full_domain: fullDomain, status: "reserved", price },
    { onConflict: "full_domain" }
  );

  return Response.json({ ok: true, order: data });
}