import { NextRequest } from "next/server";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { handleWebhook } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "payments-webhook",
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const signature = request.headers.get("x-webhook-signature");
  const result = await handleWebhook(body, signature);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}