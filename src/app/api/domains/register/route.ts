import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerDomainNamecheap } from "@/lib/domain-provider";
import { checkDomainAvailability } from "@/lib/domain-provider";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { orderId?: string; fullDomain?: string; years?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const { orderId, fullDomain, years } = body;

  if (!fullDomain) {
    return Response.json({ ok: false, error: "Domínio em falta." }, { status: 400 });
  }

  if (!process.env.NAMECHEAP_API_USER || !process.env.NAMECHEAP_API_KEY || !process.env.NAMECHEAP_CLIENT_IP) {
    return Response.json(
      {
        ok: false,
        error: "O registo automático ainda não está ligado. A nossa equipa fará o registo manualmente.",
        configured: false,
      },
      { status: 501 }
    );
  }

  // Re-verify availability right before registering to avoid registering a taken domain.
  const check = await checkDomainAvailability(fullDomain);
  if (!check.available) {
    return Response.json({ ok: false, error: "O domínio já não está disponível." }, { status: 409 });
  }

  const result = await registerDomainNamecheap({ fullDomain, years: years ?? 1 });

  if (result.ok) {
    await supabaseAdmin
      .from("domains")
      .upsert({ full_domain: fullDomain, status: "registered", checked_at: new Date().toISOString() }, { onConflict: "full_domain" });

    if (orderId) {
      await supabaseAdmin.from("domain_orders").update({ status: "registered" }).eq("id", orderId);
    }

    return Response.json({ ok: true, tld: result.tld });
  }

  return Response.json({ ok: false, error: result.error ?? "Falha ao registar o domínio." }, { status: 502 });
}
