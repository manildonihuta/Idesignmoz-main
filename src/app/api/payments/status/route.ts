import { NextRequest } from "next/server";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getStatus } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "payments-status",
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const reference = request.nextUrl.searchParams.get("reference") ?? "";
  if (!reference) {
    return Response.json({ ok: false, error: "Referência em falta." }, { status: 400 });
  }

  const result = await getStatus(reference);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}