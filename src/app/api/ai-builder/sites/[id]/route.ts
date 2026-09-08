import { NextRequest } from "next/server";

import { requireClientRoute, type AuthContext } from "@/lib/client";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { getSite, updateSite } from "@/services/ai-builder.service";
import type { ServiceFailure, ServiceSuccess } from "@/services/result";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "ai-builder-site", limit: 60, windowSec: 300 };

type AnyServiceResult = ServiceSuccess<unknown> | ServiceFailure;

function sendResult(result: AnyServiceResult): Response {
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json(result);
}

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { id } = await context.params;
  return sendResult(await getSite(ctx as AuthContext, id));
}

export async function PATCH(request: NextRequest, context: Context) {
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { id } = await context.params;

  let body: {
    businessName?: unknown;
    tagline?: unknown;
    domain?: unknown;
    industry?: unknown;
    brief?: unknown;
    primaryColor?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const result = await updateSite(ctx as AuthContext, id, {
    businessName: typeof body.businessName === "string" ? body.businessName : undefined,
    tagline: typeof body.tagline === "string" ? body.tagline : undefined,
    domain: typeof body.domain === "string" ? body.domain : undefined,
    industry: typeof body.industry === "string" ? body.industry : undefined,
    brief: typeof body.brief === "string" ? body.brief : undefined,
    primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
  });
  return sendResult(result);
}