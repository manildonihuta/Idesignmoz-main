import { NextRequest } from "next/server";
import { serverLogError } from "@/lib/server-log";
import { checkExpiringEmailServices } from "@/services/email-expiry.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily cron (vercel.json 0 7 * * *) — email service expiry reminders and
 * auto-suspension of expired services. Delegates to the email expiry service. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (request.headers.get("x-vercel-cron") !== "1" && !(secret && auth === `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await checkExpiringEmailServices();
    return Response.json(result, { status: result.ok ? 200 : result.status });
  } catch (e) {
    serverLogError("api:cron/email-expiry", e);
    return Response.json({ ok: false, error: "Falha ao processar expirações de email." }, { status: 500 });
  }
}