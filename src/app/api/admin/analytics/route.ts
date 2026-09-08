import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { getAnalyticsReport, type PeriodDays } from "@/lib/analytics";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const VALID_DAYS: PeriodDays[] = [7, 30, 90];

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
  const days: PeriodDays = (VALID_DAYS as number[]).includes(raw)
    ? (raw as PeriodDays)
    : 30;

  const report = await getAnalyticsReport(days);

  return Response.json({ ok: true, report });
}