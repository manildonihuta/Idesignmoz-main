import { NextRequest } from "next/server";
import { serverLogError } from "@/lib/server-log";
import { advanceBillingLifecycle } from "@/services/billing.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily cron (vercel.json 0 5 * * *) — advances the hosting/subscription
 * billing lifecycle: active -> past_due -> suspended -> terminated.
 * Delegates the whole pipeline to the billing service. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (request.headers.get("x-vercel-cron") !== "1" && !(secret && auth === `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await advanceBillingLifecycle();
    return Response.json(result, { status: result.ok ? 200 : result.status });
  } catch (e) {
    serverLogError("api:cron/subscriptions-billing", e);
    return Response.json({ ok: false, error: "Falha ao avançar o ciclo de facturação." }, { status: 500 });
  }
}