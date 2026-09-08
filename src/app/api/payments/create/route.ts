import { NextRequest } from "next/server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { createPayment, type PaymentCreateInput } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "payments-create",
    limit: 10,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: PaymentCreateInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await createPayment(body);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}