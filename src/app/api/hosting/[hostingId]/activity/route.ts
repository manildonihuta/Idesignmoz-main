import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { getActivity } from "@/services/hosting-panel.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "hosting-activity", limit: 60, windowSec: 60 };

type Context = { params: Promise<{ hostingId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { response: unauth, ctx } = await requireClientRoute();
  if (unauth) return unauth;

  const { hostingId } = await context.params;
  if (!UUID_RE.test(hostingId)) return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });

  const result = await getActivity(ctx, hostingId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}