import { NextRequest } from "next/server";
import { serverLogError } from "@/lib/server-log";
import { runHealthChecks } from "@/lib/providers/health";
import { runPendingSyncJobs } from "@/lib/providers/sync";
import { adminCredentialExpiryAlerts } from "@/services/infra.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Infrastructure provider health + sync cron (every 2h, see vercel.json):
 * probes every provider, turns on transparency for the active/sync inventory,
 * drains due sync jobs with retry/backoff, and alerts on expiring credentials.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (request.headers.get("x-vercel-cron") !== "1" && !(secret && auth === `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const health = await runHealthChecks(50);
    const sync = await runPendingSyncJobs(10);
    const credentialAlerts = await adminCredentialExpiryAlerts().catch(() => 0);
    return Response.json({ ok: true, health, sync, credentialAlerts }, { status: 200 });
  } catch (error) {
    serverLogError("api:cron/infra-health", error);
    return Response.json({ ok: false, error: "Falha ao monitorizar a infraestrutura." }, { status: 500 });
  }
}