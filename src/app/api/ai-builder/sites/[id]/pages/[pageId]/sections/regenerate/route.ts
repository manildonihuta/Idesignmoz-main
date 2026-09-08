import { NextRequest } from "next/server";

import { requireClientRoute, type AuthContext } from "@/lib/client";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { rewriteSection } from "@/services/ai-builder.service";
import type { ServiceFailure, ServiceSuccess } from "@/services/result";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "ai-builder-rewrite", limit: 6, windowSec: 600 };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; pageId: string }> }) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();
  const limited = await applyRateLimit(request, { ...LIMIT, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { id, pageId } = await context.params;

  let body: { index?: unknown; instruction?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const index = typeof body.index === "number" && Number.isInteger(body.index) ? body.index : -1;
  const instruction = typeof body.instruction === "string" ? body.instruction : "";

  const result: ServiceSuccess<unknown> | ServiceFailure = await rewriteSection(ctx as AuthContext, id, { pageId, index, instruction });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json(result);
}