import "server-only";

import { serverLogError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { selectEmailProvider } from "./registry";
import { logEmailActivity } from "./activity";
import type { EmailProvisionResponse } from "./types";

export type EmailProvisioningFlowResult = {
  ok: boolean;
  already?: boolean;
  error?: string;
  providerId?: string;
  providerLabel?: string;
  mode?: "simulated" | "live";
};

type EmailServiceRow = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  domain: string;
  plan_name: string;
  plan_period: string;
  mailbox_limit: number;
  storage_limit_gb: number;
  status: string;
  dns_status: string;
  expires_at: string | null;
  meta: Record<string, unknown> | null;
};

/**
 * Provisions an email service end-to-end:
 *   validate domain ownership → pick provider → create service at provider →
 *   record provider resource → snapshot usage → mark service active.
 *
 * Idempotent: an already-active service returns immediately. Provider failures
 * throw so the activation pipeline retries the job (with backoff); a domain
 * that is not (yet) owned by the customer is reported as a retryable error.
 */
export async function runEmailProvisioningFlow(emailServiceId: string): Promise<EmailProvisioningFlowResult> {
  const { data: service, error } = await supabaseAdmin
    .from("email_services")
    .select("*")
    .eq("id", emailServiceId)
    .maybeSingle();

  if (error || !service) {
    throw new Error("Serviço de email não encontrado.");
  }

  const row = service as unknown as EmailServiceRow;

  if (row.status === "active") {
    return { ok: true, already: true };
  }

  const owned = await domainOwnedBy(row);
  if (!owned.ok) {
    throw new Error(owned.error);
  }

  const selection = selectEmailProvider();

  const response = await selection.provider.createService({
    domain: row.domain,
    planName: row.plan_name,
    mailboxLimit: row.mailbox_limit,
    storageLimitGb: Number(row.storage_limit_gb),
  });

  await persistProvisioned(service as unknown as EmailServiceRow, response, selection.mode);
  return {
    ok: true,
    providerId: response.providerId,
    providerLabel: response.providerLabel,
    mode: response.mode,
  };
}

async function domainOwnedBy(row: EmailServiceRow): Promise<{ ok: boolean; error?: string; owned: boolean }> {
  if (!row.customer_id) {
    // Guest checkouts have no account; the service stays provisionable by an
    // admin but blocks auto-activation (prevents unauthorized domains).
    return { ok: true, owned: false };
  }

  const { data: existing } = await supabaseAdmin
    .from("domains")
    .select("full_domain, status")
    .eq("full_domain", row.domain)
    .eq("customer_id", row.customer_id)
    .maybeSingle();

  if (existing && existing.status === "registered") {
    return { ok: true, owned: true };
  }

  if (row.order_id) {
    const { data: jobs } = await supabaseAdmin
      .from("provisioning_jobs")
      .select("status, ref_id")
      .eq("order_id", row.order_id)
      .eq("kind", "domain");

    const registeredInOrder =
      jobs?.some((j) => j.status === "done") ?? false;

    if (registeredInOrder) {
      // Domain registered within the same order — refresh ownership below.
      const { data: recheck } = await supabaseAdmin
        .from("domains")
        .select("status")
        .eq("full_domain", row.domain)
        .eq("customer_id", row.customer_id)
        .maybeSingle();
      if (recheck && recheck.status === "registered") {
        return { ok: true, owned: true };
      }
    }
  }

  return {
    ok: false,
    owned: false,
    error: `O domínio ${row.domain} ainda não está registado em seu nome. Confirma o registo do domínio primeiro.`,
  };
}

async function persistProvisioned(
  row: EmailServiceRow,
  response: EmailProvisionResponse,
  mode: "simulated" | "live",
): Promise<void> {
  const { data: providerRow } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("slug", "email-platform")
    .maybeSingle();

  const providerId = providerRow?.id ?? null;

  const { data: resource, error: resourceErr } = await supabaseAdmin
    .from("provider_resources")
    .insert({
      provider_id: providerId,
      service_type: "email",
      internal_resource_id: row.id,
      external_resource_id: response.providerEmailId,
      status: "active",
    })
    .select("id")
    .maybeSingle();
  if (resourceErr) {
    serverLogError("email:providerResource", resourceErr);
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabaseAdmin
    .from("email_services")
    .update({
      status: "active",
      provider_status: "active",
      provider_id: providerId,
      provider_resource_id: resource?.id ?? null,
      provider_email_id: response.providerEmailId,
      meta: {
        ...(response.meta ?? {}),
        ...(row.meta ?? {}),
        provider: response.providerId,
        providerLabel: response.providerLabel,
        providerMode: mode,
      },
      updated_at: now,
    })
    .eq("id", row.id);
  if (updErr) {
    serverLogError("email:provisionFinish", updErr);
    throw new Error("Não foi possível guardar o serviço de email ativado.");
  }

  await supabaseAdmin.from("email_usage").insert({
    email_service_id: row.id,
    storage_used_gb: 0,
    storage_limit_gb: Number(row.storage_limit_gb),
    mailboxes_used: 0,
    mailboxes_limit: row.mailbox_limit,
  });

  await logEmailActivity({
    serviceId: row.id,
    actor: "system",
    action: "service.provisioned",
    details: {
      domain: row.domain,
      planName: row.plan_name,
      provider: response.providerId,
      providerEmailId: response.providerEmailId,
      mode,
      dnsStatus: row.dns_status,
    },
  });
}