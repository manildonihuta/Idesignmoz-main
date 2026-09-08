import { NextRequest } from "next/server";

import { requireClientRoute, type AuthContext } from "@/lib/client";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { saveSections } from "@/services/ai-builder.service";
import type { ServiceFailure, ServiceSuccess } from "@/services/result";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "ai-builder-save", limit: 60, windowSec: 300 };

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; pageId: string }> }) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();
  const limited = await applyRateLimit(request, LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { id, pageId } = await context.params;

  let body: { sections?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const result: ServiceSuccess<unknown> | ServiceFailure = await saveSections(ctx as AuthContext, id, pageId, body.sections);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json(result);
}