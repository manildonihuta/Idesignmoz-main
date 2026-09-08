import "server-only";

import { runHostingProvisioningFlow } from "@/lib/provisioning/hosting/orchestrator";
import { listClientHostingAccounts, type ClientHostingAccount } from "@/lib/client-data";
import { notifyEvent } from "@/lib/notifications";
import { logAudit, AUDIT } from "@/lib/security/audit";
import type { AuthContext } from "@/lib/client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fail, type ServiceResult } from "./result";
import type { Actor } from "./domain.service";

const FULL_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{2,20})+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type HostingProvisionInput = {
  orderId?: string;
  customerName?: string;
  customerEmail?: string;
  domain?: string;
  planName?: string;
  planLimits?: unknown;
  username?: string;
  paymentVerified?: boolean;
};

export async function provision(
  input: HostingProvisionInput,
  actor: Actor,
  ip?: string,
): Promise<ServiceResult<{ orderId: string } & Record<string, unknown>>> {
  const customerName = input.customerName?.trim() ?? "";
  const customerEmail = input.customerEmail?.trim() ?? "";
  const domain = input.domain?.trim().toLowerCase() ?? "";
  const planName = input.planName?.trim() ?? "";
  const orderId = input.orderId ?? `hst-${Date.now().toString(36)}`;

  if (!customerName || !customerEmail || !domain || !planName) {
    return fail(400, "Preenche o cliente, email, domínio e plano.");
  }
  if (!FULL_DOMAIN_RE.test(domain)) {
    return fail(400, "Domínio inválido.");
  }
  if (!EMAIL_RE.test(customerEmail)) {
    return fail(400, "Email inválido.");
  }

  const result = await runHostingProvisioningFlow({
    orderId,
    customerName,
    customerEmail,
    domain,
    planName,
    username: input.username,
    paymentVerified: input.paymentVerified ?? true,
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
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { domain, planName, customerEmail },
  });

  return { orderId, ...result } as ServiceResult<{ orderId: string } & Record<string, unknown>>;
}

export async function listClient(ctx: AuthContext): Promise<ClientHostingAccount[]> {
  return listClientHostingAccounts(ctx);
}

const VALID_STATUSES = new Set(["active", "suspended", "cancelled"]);

export async function setStatus(
  id: string,
  status: string,
): Promise<ServiceResult<{ account: unknown }>> {
  if (!VALID_STATUSES.has(status)) {
    return fail(400, "Estado inválido.");
  }

  const { data, error } = await supabaseAdmin
    .from("hosting_accounts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return fail(404, "Conta de alojamento não encontrada.");
  }

  return { ok: true, account: data };
}