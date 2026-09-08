import { NextRequest } from "next/server";
import { serverLogError } from "@/lib/server-log";
import { expiringDomains } from "@/services/domain.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily cron (vercel.json 0 6 * * *) — staged domain expiry reminders and
 * auto-renew preparation. Delegates the whole pipeline to the domain service
 * so the API architecture stays service-based. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (request.headers.get("x-vercel-cron") !== "1" && !(secret && auth === `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await expiringDomains();
    return Response.json(result, { status: result.ok ? 200 : result.status });
  } catch (e) {
    serverLogError("api:cron/domains-expiring", e);
    return Response.json({ ok: false, error: "Falha ao processar expirações." }, { status: 500 });
  }
}