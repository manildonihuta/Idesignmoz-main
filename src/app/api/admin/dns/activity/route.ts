import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { adminDnsListActivity } from "@/services/dns.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const guard = await requirePermissionRoute("domains.admin");
  if (guard.response) return guard.response;

  const zoneId = new URL(request.url).searchParams.get("zoneId") ?? "";
  if (!UUID_RE.test(zoneId)) {
    return Response.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
  }
  const result = await adminDnsListActivity(zoneId);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}