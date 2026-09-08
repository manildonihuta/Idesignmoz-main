import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkDomainAvailability } from "@/lib/domain-provider";
import { apiDomainOrderSchema } from "@/lib/schemas";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "domain-order",
    limit: 6,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:domains/order", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = apiDomainOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Preencha todos os campos correctamente." },
      { status: 400 }
    );
  }

  const { name: contactName, email, fullDomain, extension } = parsed.data;

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
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(domainName ?? "")) {
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
    serverLogError("api:domains/order", error);
    return Response.json({ ok: false, error: "Não foi possível registar o pedido." }, { status: 500 });
  }

  // Reserve the domain locally so it can't be ordered again while this order is open.
  await supabaseAdmin.from("domains").upsert(
    { name: domainName, extension, full_domain: fullDomain, status: "reserved", price },
    { onConflict: "full_domain" }
  );

  await logAudit({
    action: AUDIT.DOMAIN_ORDER_CREATED,
    entity: "domain_order",
    entityId: data?.id,
    actorEmail: email,
    ip,
    meta: { fullDomain, extension, price },
  });

  return Response.json({ ok: true, order: data });
}