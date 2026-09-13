import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { runHostingProvisioningFlow } from "@/lib/provisioning/hosting/orchestrator";
import type { HostingProvisionRequest } from "@/lib/provisioning/hosting/types";
import { runDomainProvisioningFlow } from "@/lib/provisioning/domain/orchestrator";
import {
  claimJob,
  listOpenJobs,
  markJobDone,
  markJobFailed,
  recomputeOrderStatus,
  type ProvisioningJob,
} from "@/lib/provisioning/jobs";

export type ActivationSummary = {
  processed: number;
  succeeded: number;
  failed: number;
};

async function orderCustomer(orderId: string): Promise<{
  name: string;
  email: string;
  phone: string;
}> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("customer_id, notes")
    .eq("id", orderId)
    .maybeSingle();

  if (order?.customer_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (profile) {
      return {
        name: String(profile.full_name ?? ""),
        email: String(profile.email ?? ""),
        phone: "",
      };
    }
  }

  const { data: payments } = await supabaseAdmin
    .from("payments")
    .select("meta")
    .eq("order_id", orderId)
    .limit(1);
  const meta = (payments?.[0]?.meta ?? {}) as { customer?: { full_name?: string; email?: string; phone?: string } };
  const customer = meta.customer ?? {};
  return {
    name: String(customer.full_name ?? ""),
    email: String(customer.email ?? ""),
    phone: String(customer.phone ?? ""),
  };
}

function hostingPlanLimits(plan: Record<string, unknown> | undefined | null): HostingProvisionRequest["planLimits"] {
  const fallback: HostingProvisionRequest["planLimits"] = {
    diskGb: 50,
    bandwidthGb: 500,
    websites: 1,
    emailAccounts: 10,
    databases: 1,
    cpu: "1 vCPU",
    ramMb: 2048,
  };
  if (!plan) return fallback;
  const cpuCores = Number(plan.cpu_cores ?? 1) || 1;
  const ramMb = Number(plan.memory_mb ?? fallback.ramMb) || fallback.ramMb;
  return {
    diskGb: Number(plan.storage_gb ?? fallback.diskGb) || fallback.diskGb,
    bandwidthGb: Number(plan.bandwidth_gb ?? fallback.bandwidthGb) || fallback.bandwidthGb,
    websites: Number(plan.sites ?? fallback.websites) || fallback.websites,
    emailAccounts: Number(plan.email_accounts ?? fallback.emailAccounts) || fallback.emailAccounts,
    databases: Number(plan.databases ?? fallback.databases) || fallback.databases,
    cpu: `${cpuCores} vCPU${cpuCores > 1 ? "s" : ""}`,
    ramMb,
  };
}

async function processHosting(job: ProvisioningJob): Promise<{ ok: boolean; error?: string }> {
  const { data: account, error: accErr } = await supabaseAdmin
    .from("hosting_accounts")
    .select("*")
    .eq("id", job.ref_id)
    .maybeSingle();
  if (accErr || !account) {
    return { ok: false, error: "Conta de alojamento não encontrada." };
  }

  const domain = String(account.domain ?? "").trim().toLowerCase();
  if (!domain) {
    return { ok: false, error: "Domínio em falta — contacta o suporte para completar a ativação." };
  }

  const { data: plan } = await supabaseAdmin
    .from("hosting_plans")
    .select("*")
    .eq("id", account.plan_id ?? "")
    .maybeSingle();

  const customer = await orderCustomer(job.order_id);
  const planName = String((plan as { name?: string } | null)?.name ?? "Alojamento");

  const result = await runHostingProvisioningFlow({
    orderId: job.order_id,
    customerName: customer.name || "Cliente",
    customerEmail: customer.email || `${domain.replace(/\./g, "-")}@idesignmoz.local`,
    domain,
    planName,
    planLimits: hostingPlanLimits(plan as Record<string, unknown> | undefined),
    username: typeof account.username === "string" && account.username ? account.username : undefined,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const now = new Date();
  const data = result.data as
    | {
        username?: unknown;
        passwordEncrypted?: unknown;
        panelUrl?: unknown;
        serverIp?: unknown;
        nameservers?: unknown;
      }
    | undefined;

  const update: Record<string, unknown> = {
    status: "active",
    username: typeof data?.username === "string" ? data.username : undefined,
    password_cipher: typeof data?.passwordEncrypted === "string" ? data.passwordEncrypted : undefined,
    panel_url: typeof data?.panelUrl === "string" ? data.panelUrl : undefined,
    server_ip: typeof data?.serverIp === "string" ? data.serverIp : undefined,
    nameservers: Array.isArray(data?.nameservers) ? data.nameservers : [],
    provisioned_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  if (account.subscription_id) {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("renews_at")
      .eq("id", account.subscription_id)
      .maybeSingle();
    if (sub?.renews_at) {
      update.renews_at = String(sub.renews_at);
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from("hosting_accounts")
    .update(update)
    .eq("id", account.id);
  if (updErr) {
    serverLogError("activation:hosting.update", updErr);
    return { ok: false, error: "Não foi possível guardar a conta ativada." };
  }

  await notifyEvent("hosting.activated", { domain, planName, customerName: customer.name || "Cliente" }, { channels: ["dashboard"] });
  await logAudit({
    action: AUDIT.PROVISIONING_HOSTING,
    entity: "hosting_account",
    entityId: account.id as string,
    meta: { domain, planName, orderId: job.order_id, automatic: true },
  });

  return { ok: true };
}

async function processDomain(job: ProvisioningJob): Promise<{ ok: boolean; error?: string }> {
  const { data: domainRow, error: domErr } = await supabaseAdmin
    .from("domains")
    .select("*")
    .eq("id", job.ref_id)
    .maybeSingle();
  if (domErr || !domainRow) {
    return { ok: false, error: "Registo de domínio não encontrado." };
  }

  const fullDomain = String(domainRow.full_domain ?? "").trim().toLowerCase();
  if (!fullDomain) {
    return { ok: false, error: "Domínio em falta." };
  }

  const customer = await orderCustomer(job.order_id);
  const years = 1;

  const result = await runDomainProvisioningFlow({
    fullDomain,
    years,
    contact: {
      firstName: customer.name || "",
      lastName: "",
      email: customer.email,
      phone: customer.phone,
      country: "MZ",
    },
    customerEmail: customer.email || undefined,
    paymentVerified: true,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime());
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + years);

  await supabaseAdmin
    .from("domains")
    .update({
      status: "registered",
      registered_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      registrar: typeof result.provider === "string" ? result.provider : null,
      updated_at: now.toISOString(),
    })
    .eq("id", domainRow.id);

  await supabaseAdmin
    .from("domain_orders")
    .update({ status: "registered" })
    .eq("full_domain", fullDomain);

  await notifyEvent("domain.registered", { fullDomain, years }, { channels: ["dashboard"] });
  await logAudit({
    action: AUDIT.PROVISIONING_DOMAIN,
    entity: "domain",
    entityId: domainRow.id as string,
    meta: { fullDomain, years, orderId: job.order_id, automatic: true },
  });

  return { ok: true };
}

/** Process the activation queue (idempotent, safe under concurrent cron runs). */
export async function processActivationJobs(limit = 20): Promise<ActivationSummary> {
  const jobs = await listOpenJobs(limit);
  const summary: ActivationSummary = { processed: 0, succeeded: 0, failed: 0 };

  for (const job of jobs) {
    const claimed = await claimJob(job.id, job.attempts);
    if (!claimed) continue;
    summary.processed += 1;

    try {
      const outcome =
        job.kind === "hosting" ? await processHosting(job) : await processDomain(job);
      if (outcome.ok) {
        summary.succeeded += 1;
        await markJobDone(job.id, job.order_id);
      } else {
        summary.failed += 1;
        await markJobFailed(job.id, job.order_id, outcome.error ?? "Falha desconhecida.");
      }
    } catch (e) {
      summary.failed += 1;
      serverLogError("activation:process", e);
      await markJobFailed(job.id, job.order_id, e instanceof Error ? e.message : String(e));
    }
  }

  return summary;
}

export { recomputeOrderStatus };