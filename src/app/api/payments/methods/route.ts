import { listMethods } from "@/services/payment.service";

export const dynamic = "force-dynamic";

/** Enabled payment gateways surfaced from the DB site-settings config. */
export async function GET() {
  const methods = await listMethods();
  return Response.json({ ok: true, methods });
}