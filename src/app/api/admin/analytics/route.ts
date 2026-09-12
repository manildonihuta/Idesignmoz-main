import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { report, isPeriodDays } from "@/services/analytics.service";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermissionRoute("analytics.view");
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, {
    prefix: "admin-analytics",
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const raw = Number(request.nextUrl.searchParams.get("days"));
  const days = isPeriodDays(raw) ? raw : 30;

  const result = await report(days);
  if (!result.ok) return Response.json(result, { status: result.status });

  const { ok, ...reportData } = result;

  return Response.json({ ok, report: reportData });
}