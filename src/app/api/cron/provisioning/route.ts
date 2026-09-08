import { NextRequest } from "next/server";
import { serverLogError } from "@/lib/server-log";
import { runActivationPipeline } from "@/services/activation.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Activation cron (every 5 minutes, see vercel.json) — provisions pending
 * hosting and domain purchases placed during checkout
 * (order status: paid → processing → completed). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (request.headers.get("x-vercel-cron") !== "1" && !(secret && auth === `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runActivationPipeline();
    return Response.json(result, { status: result.ok ? 200 : result.status });
  } catch (e) {
    serverLogError("api:cron/provisioning", e);
    return Response.json({ ok: false, error: "Falha ao processar ativações." }, { status: 500 });
  }
}