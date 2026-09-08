import { NextRequest } from "next/server";
import { requirePermissionRoute } from "@/lib/admin";
import { runDomainProvisioningFlow } from "@/lib/provisioning/domain/orchestrator";
import type { DomainContact } from "@/lib/provisioning/domain/types";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

const FULL_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{2,20})+$/i;

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("provisioning.manage");
  if (guard.response) return guard.response;
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();
  const body0: Record<string, unknown> | null = await request.json().catch(() => null);
  if (!body0 || typeof body0 !== "object") {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }
  const body = body0 as {
    fullDomain?: string;
    years?: number;
    contact?: DomainContact;
    customerEmail?: string;
    hostingPlan?: string;
    nameservers?: string[];
    paymentVerified?: boolean;
  };

  const fullDomain = body?.fullDomain?.trim().toLowerCase() ?? "";
  if (!fullDomain || !FULL_DOMAIN_RE.test(fullDomain)) {
    return Response.json({ ok: false, error: "Domínio inválido." }, { status: 400 });
  }

  const years = Number.isInteger(body?.years) ? body!.years! : 1;
  if (years < 1 || years > 10) {
    return Response.json({ ok: false, error: "Duração entre 1 e 10 anos." }, { status: 400 });
  }

  const result = await runDomainProvisioningFlow({
    fullDomain,
    years,
    contact: body?.contact,
    customerEmail: body?.customerEmail,
    hostingPlan: body?.hostingPlan,
    nameservers: body?.nameservers,
    paymentVerified: body?.paymentVerified ?? true,
  });

  await logAudit({
    action: AUDIT.PROVISIONING_DOMAIN,
    entity: "domain",
    entityId: fullDomain,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta: { fullDomain, years },
  });

  return Response.json({ ...result });
}