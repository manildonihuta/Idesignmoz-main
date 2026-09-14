import { NextRequest } from "next/server";

import { requireClientRoute, type AuthContext } from "@/lib/client";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { generateSite, listSites } from "@/services/ai-builder.service";
import type { ServiceFailure, ServiceSuccess } from "@/services/result";

export const dynamic = "force-dynamic";

const GENERATE_LIMIT = { prefix: "ai-builder-generate", limit: 4, windowSec: 600 };
const LIST_LIMIT = { prefix: "ai-builder-list", limit: 30, windowSec: 300 };

type AnyServiceResult = ServiceSuccess<unknown> | ServiceFailure;

function sendResult(result: AnyServiceResult): Response {
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json(result);
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, LIST_LIMIT);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  return sendResult(await listSites(ctx as AuthContext));
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();
  const limited = await applyRateLimit(request, { ...GENERATE_LIMIT, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  let body: {
    siteId?: unknown;
    templateId?: unknown;
    businessName?: unknown;
    industry?: unknown;
    domain?: unknown;
    tagline?: unknown;
    brief?: unknown;
    primaryColor?: unknown;
    accentColor?: unknown;
    colorPreference?: unknown;
    style?: unknown;
    typography?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const businessName = typeof body.businessName === "string" ? body.businessName : "";
  const brief = typeof body.brief === "string" ? body.brief : "";

  if (!businessName.trim() || !brief.trim()) {
    return Response.json({ ok: false, error: "Indique o nome do negócio e descreva o que faz." }, { status: 400 });
  }

  const colorPreference = body.colorPreference === "brand" || body.colorPreference === "custom" ? body.colorPreference : "auto";
  const typography = body.typography === "sans" || body.typography === "display" || body.typography === "mono" ? body.typography : undefined;

  const result = await generateSite(ctx as AuthContext, {
    siteId: typeof body.siteId === "string" ? body.siteId : undefined,
    templateId: typeof body.templateId === "string" && body.templateId ? body.templateId : undefined,
    businessName,
    industry: typeof body.industry === "string" ? body.industry : undefined,
    domain: typeof body.domain === "string" ? body.domain : undefined,
    tagline: typeof body.tagline === "string" ? body.tagline : undefined,
    brief,
    primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
    accentColor: typeof body.accentColor === "string" ? body.accentColor : undefined,
    colorPreference,
    style: typeof body.style === "string" ? body.style : undefined,
    typography,
  });
  return sendResult(result);
}