import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { aliasAction } from "@/services/email.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "email-aliases-action", limit: 30, windowSec: 60 };

type Context = { params: Promise<{ serviceId: string; aliasId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { serviceId, aliasId } = await context.params;
  if (!UUID_RE.test(serviceId) || !UUID_RE.test(aliasId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  const result = await aliasAction(ctx, serviceId, aliasId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}