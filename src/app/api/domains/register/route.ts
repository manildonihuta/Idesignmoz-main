import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requirePermissionRoute } from "@/lib/admin";
import { registerDomainNamecheap } from "@/lib/domain-provider";
import { checkDomainAvailability } from "@/lib/domain-provider";
import { domainRegisterSchema } from "@/lib/schemas";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.register");
  if (guard.response) return guard.response;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "domain-register",
    limit: 15,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:domains/register", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = domainRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Domínio em falta." }, { status: 400 });
  }
  const { orderId, fullDomain, years } = parsed.data;

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

    let customer: { email?: string; name?: string } = {};
    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from("domain_orders")
        .select("email, name")
        .eq("id", orderId)
        .maybeSingle();
      customer = order ?? {};
    }

    await notifyEvent(
      "domain.registered",
      { fullDomain, years: years ?? 1 },
      { recipients: customer.email ? [{ email: customer.email, name: customer.name }] : [] },
    );

    await logAudit({
      action: AUDIT.DOMAIN_REGISTERED,
      entity: "domain",
      entityId: orderId,
      actorId: guard.ctx.userId,
      actorEmail: guard.ctx.email,
      actorRole: guard.ctx.role,
      ip,
      meta: { fullDomain, years },
    });

    return Response.json({ ok: true, tld: result.tld });
  }

  return Response.json({ ok: false, error: result.error ?? "Falha ao registar o domínio." }, { status: 502 });
}