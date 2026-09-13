import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { getEmailDnsConfigs } from "@/services/email-dns.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "email-dns", limit: 90, windowSec: 60 };

type Context = { params: Promise<{ serviceId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { serviceId } = await context.params;
  if (!UUID_RE.test(serviceId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const result = await getEmailDnsConfigs(ctx, serviceId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}