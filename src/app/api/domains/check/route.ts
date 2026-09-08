import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkDomainAvailability } from "@/lib/domain-provider";
import { domainCheckQuerySchema } from "@/lib/schemas";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "domain-check",
    limit: 90,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const searchParams = request.nextUrl.searchParams;
  const parsed = domainCheckQuerySchema.safeParse({
    name: searchParams.get("name") ?? "",
    extension: searchParams.get("extension") ?? "",
  });
  if (!parsed.success) {
    return Response.json(
      { available: false, error: "Nome de domínio inválido. Use apenas letras, números e hífens." },
      { status: 400 }
    );
  }

  const { name: rawName, extension } = parsed.data;
  const name = rawName.toLowerCase().replace(/\s+/g, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) || name.length < 2) {
    return Response.json(
      { available: false, error: "Nome de domínio inválido. Use apenas letras, números e hífens." },
      { status: 400 }
    );
  }

  const { data: ext } = await supabaseAdmin
    .from("domain_extensions")
    .select("*")
    .eq("extension", extension)
    .eq("active", true)
    .maybeSingle();

  if (!ext) {
    return Response.json({ available: false, error: "Extensão de domínio não suportada." }, { status: 400 });
  }

  const fullDomain = `${name}${extension}`;

  // 1. Local registry — if we already know it's taken, short-circuit.
  const { data: existing } = await supabaseAdmin
    .from("domains")
    .select("status")
    .eq("full_domain", fullDomain)
    .maybeSingle();

  const locallyTaken = existing?.status === "registered" || existing?.status === "reserved";
  if (locallyTaken) {
    return Response.json({
      available: false,
      fullDomain,
      name,
      extension,
      status: existing.status,
      price: ext.registration,
      source: "registry",
    });
  }

  // 2. Real availability via RDAP (default) or Namecheap (when configured).
  const check = await checkDomainAvailability(fullDomain);

  if (!check.available) {
    // Mark as registered in the local registry so future checks short-circuit.
    await supabaseAdmin
      .from("domains")
      .upsert(
        { name, extension, full_domain: fullDomain, status: "registered", price: ext.registration },
        { onConflict: "full_domain" }
      );
    return Response.json({
      available: false,
      fullDomain,
      name,
      extension,
      status: "registered",
      price: ext.registration,
      source: check.source,
      error: check.message ?? "Indisponível para registo.",
    });
  }

  // 3. Available — record the positive lookup.
  const { data: lookup, error: lookupError } = await supabaseAdmin
    .from("domains")
    .upsert(
      { name, extension, full_domain: fullDomain, status: "available", price: ext.registration },
      { onConflict: "full_domain" }
    )
    .select()
    .single();

  if (lookupError) {
    serverLogError("api:domains/check", lookupError);
    return Response.json({ available: false, error: "Erro ao registar a consulta." }, { status: 500 });
  }

  return Response.json({
    available: true,
    fullDomain,
    name,
    extension,
    status: lookup.status,
    price: lookup.price,
    renewal: ext.renewal,
    source: check.source,
  });
}
