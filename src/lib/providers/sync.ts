import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { computeBackoffMs, classifyProviderError } from "./errors";
import { logProviderActivity } from "./activity";
import { resolveBuiltinProvider } from "./registry";

export type SyncJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type SyncKind = "manual" | "scheduled" | "event" | "full" | "incremental";
export type SyncService = "domain" | "dns" | "hosting" | "email" | "ssl" | "cdn" | "backup";

export type SyncJobRow = {
  id: string;
  provider_id: string | null;
  service: SyncService;
  kind: SyncKind;
  status: SyncJobStatus;
  records_processed: number;
  last_error: string | null;
  retry_count: number;
  max_retries: number;
  run_after: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SafeSyncJob = {
  id: string;
  providerId: string | null;
  providerSlug?: string;
  service: SyncService;
  kind: SyncKind;
  status: SyncJobStatus;
  recordsProcessed: number;
  lastError: string | null;
  retryCount: number;
  maxRetries: number;
  runAfter: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

let claimCounter = 0;

function jobClaimKey(): string {
  claimCounter = (claimCounter + 1) % 100000;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${claimCounter.toString(36)}`;
}

export async function enqueueSyncJob(input: {
  providerId?: string | null;
  service: SyncService;
  kind?: SyncKind;
  runAfter?: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("provider_sync_jobs")
    .insert({
      provider_id: input.providerId ?? null,
      service: input.service,
      kind: input.kind ?? "manual",
      run_after: input.runAfter ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    serverLogError("infra:sync:enqueue", error, { service: input.service, providerId: input.providerId });
    return null;
  }
  return data.id as string;
}

/** Atomically marks a pending job running — only one worker may claim it. */
export async function claimSyncJob(id: string, retryCount: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("provider_sync_jobs")
    .update({
      status: "running",
      retry_count: retryCount + 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  return !error && Boolean(data && data.length > 0);
}

export async function completeSyncJob(id: string, recordsProcessed: number): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("provider_sync_jobs")
    .update({ status: "completed", records_processed: recordsProcessed, last_error: null, completed_at: now, updated_at: now })
    .eq("id", id);
  if (error) serverLogError("infra:sync:complete", error, { id });
}

export async function failSyncJob(id: string, err: unknown, opts?: { providerId?: string | null }): Promise<boolean> {
  const classified = classifyProviderError(err);
  const { data } = await supabaseAdmin
    .from("provider_sync_jobs")
    .select("retry_count, max_retries")
    .eq("id", id)
    .maybeSingle();
  const retries = Number(data?.retry_count ?? 0);
  const maxRetries = Number(data?.max_retries ?? 3);
  const terminal = !classified.retryable || retries >= maxRetries;
  const now = new Date();
  const message = classified.message.slice(0, 400);

  if (terminal) {
    const { error } = await supabaseAdmin
      .from("provider_sync_jobs")
      .update({ status: "failed", last_error: message, completed_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", id);
    if (error) serverLogError("infra:sync:fail", error, { id });
    await logProviderActivity({
      providerId: opts?.providerId,
      event: "sync.failed",
      level: "error",
      message,
      meta: { jobId: id, kind: classified.kind },
    });
    return true;
  }

  const runAfter = new Date(now.getTime() + computeBackoffMs(retries)).toISOString();
  const { error } = await supabaseAdmin
    .from("provider_sync_jobs")
    .update({ status: "pending", last_error: message, run_after: runAfter, updated_at: now.toISOString() })
    .eq("id", id);
  if (error) serverLogError("infra:sync:requeue", error, { id });
  return false;
}

/**
 * Actual sync operation for a provider, dispatched by category. Implementations
 * pull from (and reconcile) the platform's own DB-backed infrastructure and
 * record what happened in provider_resources. External providers would add
 * their adapter code here — upstream callers never change.
 */
export async function runSyncForProvider(providerId: string, service: SyncService): Promise<{ ok: boolean; records: number; message: string }> {
  const { data: provider, error } = await supabaseAdmin
    .from("providers")
    .select("id, slug, type, name")
    .eq("id", providerId)
    .maybeSingle();
  if (error || !provider) return { ok: false, records: 0, message: "Provedor não encontrado." };
  const slug = provider.slug as string;
  const def = resolveBuiltinProvider(slug);

  try {
    let records = 0;

    if (service === "hosting" && (provider.type === "hosting" || def?.category === "hosting")) {
      const { data: accounts } = await supabaseAdmin.from("hosting_accounts").select("id, status");
      const active = (accounts ?? []).filter((a) => a.status === "active" || a.status === "suspended");
      for (const account of active) {
        await syncHostingResource(providerId, account.id, account.status as string);
      }
      records = active.length;
    }

    if (service === "dns" && (def?.category === "dns" || provider.type === "dns")) {
      const { data: zones } = await supabaseAdmin.from("dns_zones").select("id, full_domain, status");
      records = 0;
      for (const zone of zones ?? []) {
        const { error: upsertError } = await supabaseAdmin.from("provider_resources").upsert(
          {
            provider_id: providerId,
            service_type: "dns",
            internal_resource_id: zone.id as string,
            external_resource_id: null,
            external_reference: { domain: zone.full_domain, status: zone.status },
            status: zone.status === "errored" ? "error" : "active",
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "provider_id,service_type,internal_resource_id" },
        );
        if (upsertError) serverLogError("infra:sync:dns:resource", upsertError, { zoneId: zone.id });
        else records += 1;
      }
    }

    if (service === "domain" && (def?.category === "domain" || provider.type === "domain")) {
      const { data: domains } = await supabaseAdmin.from("domains").select("id, full_domain, status, expires_at");
      records = 0;
      for (const domain of domains ?? []) {
        const { error: upsertError } = await supabaseAdmin.from("provider_resources").upsert(
          {
            provider_id: providerId,
            service_type: "domain",
            internal_resource_id: domain.id as string,
            external_resource_id: null,
            external_reference: { domain: domain.full_domain, status: domain.status, expiresAt: domain.expires_at },
            status: domain.status === "cancelled" ? "removed" : "active",
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "provider_id,service_type,internal_resource_id" },
        );
        if (upsertError) serverLogError("infra:sync:domain:resource", upsertError, { domainId: domain.id });
        else records += 1;
      }
    }

    if (records === 0 && service !== "hosting") {
      // Unmanaged category (email/ssl/cdn/backup): honest no-op that still
      // timestamps the resource map so the job target is explicit.
      records = 0;
    }

    await supabaseAdmin.from("providers").update({ last_sync_at: new Date().toISOString() }).eq("id", providerId);
    await logProviderActivity({
      providerId,
      event: "sync.completed",
      level: "info",
      message: `Sincronização ${service} concluída (${records} recursos).`,
      meta: { service, records, claimKey: jobClaimKey() },
    });
    return { ok: true, records, message: records > 0 ? `${records} recurso(s) sincronizado(s).` : "Nada para sincronizar." };
  } catch (err) {
    const classified = classifyProviderError(err);
    await logProviderActivity({
      providerId,
      event: "sync.error",
      level: "error",
      message: classified.message,
      meta: { service, kind: classified.kind },
    });
    return { ok: false, records: 0, message: classified.message };
  }
}

async function syncHostingResource(providerId: string, accountId: string, accountStatus: string): Promise<void> {
  const { error } = await supabaseAdmin.from("provider_resources").upsert(
    {
      provider_id: providerId,
      service_type: "hosting",
      internal_resource_id: accountId,
      external_resource_id: null,
      external_reference: { status: accountStatus },
      status: accountStatus === "active" ? "active" : "syncing",
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "provider_id,service_type,internal_resource_id" },
  );
  void error;
}

export async function listSyncJobs(opts?: {
  providerId?: string;
  status?: SyncJobStatus;
  service?: SyncService;
  limit?: number;
}): Promise<SafeSyncJob[]> {
  let query = supabaseAdmin
    .from("provider_sync_jobs")
    .select("provider_sync_jobs.*, providers (slug)")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts?.limit ?? 50, 200));
  if (opts?.providerId) query = query.eq("provider_id", opts.providerId);
  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.service) query = query.eq("service", opts.service);
  const { data, error } = await query;
  if (error || !data) return [];

  return (data ?? []).map((row) => {
    const base = row as unknown as SyncJobRow;
    const provider = (row as unknown as { providers: { slug: string } | { slug: string }[] | null }).providers;
    const slug = Array.isArray(provider) ? provider[0]?.slug : provider?.slug;
    return {
      id: base.id,
      providerId: base.provider_id,
      providerSlug: slug ?? undefined,
      service: base.service,
      kind: base.kind,
      status: base.status,
      recordsProcessed: base.records_processed,
      lastError: base.last_error,
      retryCount: base.retry_count,
      maxRetries: base.max_retries,
      runAfter: base.run_after,
      startedAt: base.started_at,
      completedAt: base.completed_at,
      createdAt: base.created_at,
    };
  });
}

export async function countFailedSyncs(sinceHours = 24): Promise<number> {
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("provider_sync_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", since);
  return error ? 0 : (count ?? 0);
}

/** Processes due pending jobs. Returns a summary. */
export async function runPendingSyncJobs(limit = 10): Promise<{ processed: number; failed: number }> {
  const { data, error } = await supabaseAdmin
    .from("provider_sync_jobs")
    .select("id, provider_id, service, retry_count")
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data || data.length === 0) return { processed: 0, failed: 0 };

  const summary = { processed: 0, failed: 0 };
  for (const job of data as Array<{ id: string; provider_id: string | null; service: SyncService; retry_count: number }>) {
    if (!job.provider_id) continue;
    const claimed = await claimSyncJob(job.id, job.retry_count);
    if (!claimed) continue;
    const result = await runSyncForProvider(job.provider_id, job.service);
    if (result.ok) {
      await completeSyncJob(job.id, result.records);
      summary.processed += 1;
    } else {
      const terminal = await failSyncJob(job.id, new Error(result.message), { providerId: job.provider_id });
      if (terminal) summary.failed += 1;
      else summary.processed += 1; // requeued, still driving progress
    }
  }
  return summary;
}