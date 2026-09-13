import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { getAdminContext } from "@/lib/admin";
import { hasPermission } from "@/lib/security/rbac";
import { pdfHtml } from "@/services/invoice.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = clientIp(request);
  const limited = await applyRateLimit(request, { prefix: "invoice-pdf", limit: 40, windowSec: 60, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return Response.json({ ok: false, error: "Fatura inválida." }, { status: 400 });
  }

  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("id, customer_id")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) {
    return Response.json({ ok: false, error: "Fatura não encontrada." }, { status: 404 });
  }

  const own = invoice.customer_id === user.id;
  if (!own) {
    const ctx = await getAdminContext();
    if (!hasPermission(ctx.role, "billing.manage")) {
      return Response.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
    }
  }

  const result = await pdfHtml(id).catch((e) => {
    serverLogError("api:invoices/pdf", e);
    return { ok: false as const, error: "Não foi possível gerar a fatura." };
  });

  if (!result.ok) {
    return Response.json(result, { status: (result as { status?: number }).status ?? 500 });
  }

  const number = (result.number ?? id).replace(/[^\w.-]/g, "");
  return new Response(result.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="fatura-${number}.html"`,
      "Cache-Control": "private, no-store",
    },
  });
}