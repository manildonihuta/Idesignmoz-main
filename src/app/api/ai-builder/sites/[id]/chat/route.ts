import { NextRequest } from "next/server";

import { requireClientRoute, type AuthContext } from "@/lib/client";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { chatAssistant } from "@/services/ai-builder.service";
import type { ServiceFailure, ServiceSuccess } from "@/services/result";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "ai-builder-chat", limit: 20, windowSec: 600 };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();
  const limited = await applyRateLimit(request, { ...LIMIT, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { id } = await context.params;

  let body: { message?: unknown; pageId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const result: ServiceSuccess<unknown> | ServiceFailure = await chatAssistant(ctx as AuthContext, id, {
    message: typeof body.message === "string" ? body.message : "",
    pageId: typeof body.pageId === "string" ? body.pageId : undefined,
  });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json(result);
}