import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkDomainAvailability } from "@/lib/domain-provider";

export const dynamic = "force-dynamic";

function sanitizeName(raw: string): string | null {
  const name = raw.toLowerCase().replace(/\s+/g, "").trim();
  if (!name || name.length < 2 || name.length > 63) return null;
  if (!/^[a-z0-9-]+$/.test(name)) return null;
  if (name.startsWith("-") || name.endsWith("-")) return null;
  return name;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const nameRaw = searchParams.get("name") ?? "";
  const extension = searchParams.get("extension") ?? "";

  const name = sanitizeName(nameRaw);
  if (!name) {
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
