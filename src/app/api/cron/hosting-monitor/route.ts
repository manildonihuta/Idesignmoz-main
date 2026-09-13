import { NextRequest } from "next/server";
import { serverLogError } from "@/lib/server-log";
import { runHostingMonitor } from "@/services/hosting-monitor.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hosting health monitor cron (daily, see vercel.json) — checks quota
 * thresholds, SSL expiry, failed backups and offline websites, writing
 * resource alerts and staff notifications when state changes. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (request.headers.get("x-vercel-cron") !== "1" && !(secret && auth === `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const summary = await runHostingMonitor();
    return Response.json({ ok: true, ...summary }, { status: 200 });
  } catch (e) {
    serverLogError("api:cron/hosting-monitor", e);
    return Response.json({ ok: false, error: "Falha ao monitorizar alojamentos." }, { status: 500 });
  }
}