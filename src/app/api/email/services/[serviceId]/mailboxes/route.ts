import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { createMailbox } from "@/services/email.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "email-mailboxes-create", limit: 20, windowSec: 60 };

type Context = { params: Promise<{ serviceId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { serviceId } = await context.params;
  if (!UUID_RE.test(serviceId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }

  let body: { localPart?: unknown; displayName?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await createMailbox(ctx, serviceId, body);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}