import { fetchAdminDashboard, requirePermissionRoute } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermissionRoute("operations.view");
  if (guard.response) return guard.response;

  const data = await fetchAdminDashboard();
  return Response.json({ ok: true, data });
}