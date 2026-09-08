import { NextRequest } from "next/server";
import { requirePermissionRoute } from "@/lib/admin";
import { runHostingProvisioningFlow } from "@/lib/provisioning/hosting/orchestrator";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";

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
    orderId?: string;
    customerName?: string;
    customerEmail?: string;
    domain?: string;
    planName?: string;
    planLimits?: unknown;
    username?: string;
    paymentVerified?: boolean;
  };

  const customerName = body?.customerName?.trim() ?? "";
  const customerEmail = body?.customerEmail?.trim() ?? "";
  const domain = body?.domain?.trim().toLowerCase() ?? "";
  const planName = body?.planName?.trim() ?? "";
  const orderId = body?.orderId ?? `hst-${Date.now().toString(36)}`;

  if (!customerName || !customerEmail || !domain || !planName) {
    return Response.json({ ok: false, error: "Preenche o cliente, email, domínio e plano." }, { status: 400 });
  }
  if (!FULL_DOMAIN_RE.test(domain)) {
    return Response.json({ ok: false, error: "Domínio inválido." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return Response.json({ ok: false, error: "Email inválido." }, { status: 400 });
  }

  const result = await runHostingProvisioningFlow({
    orderId,
    customerName,
    customerEmail,
    domain,
    planName,
    username: body?.username,
    paymentVerified: body?.paymentVerified ?? true,
  });

  if (result.ok) {
    await notifyEvent(
      "hosting.activated",
      { domain, planName, customerName },
      { channels: ["dashboard"] },
    );
  }

  await logAudit({
    action: AUDIT.PROVISIONING_HOSTING,
    entity: "hosting_account",
    entityId: orderId,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta: { domain, planName, customerEmail },
  });

  return Response.json({ ...result, orderId });
}