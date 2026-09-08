import { NextRequest } from "next/server";
import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { provision, type HostingProvisionInput } from "@/services/hosting.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("provisioning.manage");
  if (guard.response) return guard.response;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "hosting-provision",
    limit: 10,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: HostingProvisionInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await provision(body, guard.ctx, ip);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}