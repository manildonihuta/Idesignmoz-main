import { NextRequest } from "next/server";
import { requireRolesRoute } from "@/lib/admin";
import { STAFF_ROLES } from "@/lib/security/rbac";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { listStaff } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireRolesRoute(STAFF_ROLES);
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, {
    prefix: "notifications:list",
    limit: 120,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const result = await listStaff(guard.ctx);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}