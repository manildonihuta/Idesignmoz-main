import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminRoute } from "@/lib/admin";
import { checkDomainAvailability, registerDomainNamecheap } from "@/lib/domain-provider";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (guard.response) return guard.response;

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const orderId = body?.orderId ?? "";
  if (!UUID_RE.test(orderId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("domain_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return Response.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
  }

  const fullDomain = order.full_domain;
  const extension = order.extension;
  const domainName = fullDomain.endsWith(extension) ? fullDomain.slice(0, -extension.length) : fullDomain;

  if (order.status === "registered") {
    return Response.json({ ok: true, mode: "already", note: "Pedido já estava registado." });
  }

  async function markRegistered() {
    await supabaseAdmin
      .from("domains")
      .upsert({ name: domainName, extension, full_domain: fullDomain, status: "registered", price: order.price }, { onConflict: "full_domain" });
    await supabaseAdmin.from("domain_orders").update({ status: "registered" }).eq("id", orderId);
  }

  const namecheapConfigured =
    process.env.NAMECHEAP_API_USER && process.env.NAMECHEAP_API_KEY && process.env.NAMECHEAP_CLIENT_IP;

  if (!namecheapConfigured) {
    await markRegistered();
    return Response.json({
      ok: true,
      mode: "manual",
      note: "Registo automático desligado — domínio marcado como registado manualmente.",
    });
  }

  const check = await checkDomainAvailability(fullDomain);
  if (!check.available) {
    return Response.json(
      { ok: false, mode: "unavailable", error: "O domínio já não está disponível para registo." },
      { status: 409 }
    );
  }

  const result = await registerDomainNamecheap({ fullDomain });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error ?? "Falha ao registar o domínio." }, { status: 502 });
  }

  await markRegistered();
  return Response.json({ ok: true, mode: "automatic", tld: result.tld, note: "Domínio registado com sucesso." });
}