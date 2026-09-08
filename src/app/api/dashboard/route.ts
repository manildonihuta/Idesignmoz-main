import { NextRequest } from "next/server";
import { requirePermissionRoute, requireRolesRoute } from "@/lib/admin";
import { requireClientRoute } from "@/lib/client";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { adminDashboard, clientDashboard, analyticsReport } from "@/services/dashboard.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "dashboard",
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const clientGuard = await requireClientRoute();
  if (clientGuard.ctx?.userId) {
    const result = await clientDashboard(clientGuard.ctx);
    return Response.json(result, { status: result.ok ? 200 : result.status });
  }

  const adminGuard = await requirePermissionRoute("operations.view");
  if (adminGuard.response) return adminGuard.response;

  const [overview, report] = await Promise.all([adminDashboard(), analyticsReport(30)]);
  return Response.json({ ok: true, data: { overview, report } });
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "dashboard",
    limit: 30,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const guard = await requireRolesRoute(["super_admin", "admin", "manager", "sales"] as const);
  if (guard.response) return guard.response;

  let body: { days?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const report = await analyticsReport(body.days === 7 || body.days === 90 ? body.days : 30);
  return Response.json({ ok: true, report });
}