import { listAdminSubscriptions, requirePermissionRoute } from "@/lib/admin";
import { advanceBillingLifecycle } from "@/services/billing.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermissionRoute("billing.manage");
  if (guard.response) return guard.response;

  const subscriptions = await listAdminSubscriptions();
  return Response.json({ ok: true, subscriptions });
}

export async function POST() {
  const guard = await requirePermissionRoute("billing.manage");
  if (guard.response) return guard.response;

  const result = await advanceBillingLifecycle();
  return Response.json({ ok: true, result });
}