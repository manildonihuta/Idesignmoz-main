import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { serverLogError } from "@/lib/server-log";
import { emailRenewalQuote, createEmailRenewalRequest } from "@/services/email-renewal.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "email-renew", limit: 90, windowSec: 60 };

type Context = { params: Promise<{ serviceId: string }> };

/** Price quote (GET) or renewal order creation (POST) for a client-owned email service. */
export async function GET(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { serviceId } = await context.params;
  if (!UUID_RE.test(serviceId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const monthsRaw = new URL(request.url).searchParams.get("months");
  const months = Number(monthsRaw ?? "12");
  const result = await emailRenewalQuote(ctx, serviceId, months);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { serviceId } = await context.params;
  if (!UUID_RE.test(serviceId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  let body: { months?: unknown; method?: unknown; reference?: unknown };
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:email/renew", e);
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const months = Number(body.months ?? 12);
  const method = typeof body.method === "string" ? body.method : "";
  const reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : "";

  const result = await createEmailRenewalRequest(ctx, serviceId, { months, method, reference });
  return Response.json(result, { status: result.ok ? 200 : result.status });
}