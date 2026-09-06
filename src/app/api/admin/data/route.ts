import { fetchAdminDashboard, requireAdminRoute } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminRoute();
  if (guard.response) return guard.response;

  const data = await fetchAdminDashboard();
  return Response.json({ ok: true, data });
}