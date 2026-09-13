import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { fail, type ServiceResult } from "./result";
import { PROVIDER_CATEGORY_LABEL, PROVIDER_STATUS_LABEL, PROVIDER_HEALTH_LABEL, type ProviderStatus } from "@/lib/providers/types";
import {
  listProviderCredentials,
  storeProviderCredential,
  testProviderCredential as vaultTestCredential,
  rotateProviderCredential as vaultRotateCredential,
  revokeProviderCredential as vaultRevokeCredential,
  type SafeProviderCredential,
} from "@/lib/providers/vault";
import { runHealthChecks, checkProviderHealth, lastHealthCheck } from "@/lib/providers/health";
import {
  enqueueSyncJob,
  runSyncForProvider,
  listSyncJobs,
  countFailedSyncs,
  runPendingSyncJobs,
  type SafeSyncJob,
  type SyncService,
} from "@/lib/providers/sync";
import { listProviderActivity, countProviderErrors, type SafeActivityLog } from "@/lib/providers/activity";
import {
  listWebhookEndpoints,
  saveWebhookEndpoint,
  deleteWebhookEndpoint,
  testWebhookEndpoint as vaultTestWebhook,
  newWebhookSecret,
  listInboundEvents,
  type SafeWebhookEndpoint,
} from "@/lib/providers/webhooks";
import { resolveBuiltinProvider } from "@/lib/providers/registry";

export type AdminActor = { userId?: string; email?: string; role: string; ip?: string };

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  adapter: string | null;
  status: ProviderStatus;
  environment: string;
  capabilities: string[];
  api_endpoint: string | null;
  config: unknown;
  is_builtin: boolean;
  sort: number;
  last_health_at: string | null;
  last_sync_at: string | null;
  created_at: string;
};

type HealthView = {
  provider_id: string;
  status: string;
  response_time_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  checked_at: string;
};

export type AdminProviderView = {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  adapter: string | null;
  status: ProviderStatus;
  statusLabel: string;
  environment: string;
  capabilities: string[];
  configured: boolean;
  apiEndpoint: string | null;
  isBuiltin: boolean;
  lastHealthAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  health: HealthView | null;
};

export type InfraOverview = {
  totalProviders: number;
  activeProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unavailableProviders: number;
  pendingSyncs: number;
  failedSyncs24h: number;
  providerErrors24h: number;
  avgResponseTimeMs: number | null;
  expiringCredentials: number;
};

export type ProviderDetail = AdminProviderView & {
  resourcesByService: Array<{ service: string; count: number }>;
  credentials: SafeProviderCredential[];
  syncs: SafeSyncJob[];
  webhooks: SafeWebhookEndpoint[];
  activity: SafeActivityLog[];
  healthHistory: HealthView[];
};

function mapProviderView(row: ProviderRow, health?: HealthView | null): AdminProviderView {
  const def = resolveBuiltinProvider(row.slug);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.type,
    categoryLabel: PROVIDER_CATEGORY_LABEL[row.type as keyof typeof PROVIDER_CATEGORY_LABEL] ?? row.type,
    adapter: row.adapter,
    status: row.status,
    statusLabel: PROVIDER_STATUS_LABEL[row.status] ?? row.status,
    environment: row.environment,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    configured: def ? def.configured : false,
    apiEndpoint: row.api_endpoint,
    isBuiltin: row.is_builtin,
    lastHealthAt: row.last_health_at,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    health: health ?? null,
  };
}

async function latestHealthByProvider(): Promise<Map<string, HealthView>> {
  const { data, error } = await supabaseAdmin
    .from("provider_health_checks")
    .select("provider_id, status, response_time_ms, error_class, error_message, checked_at")
    .order("checked_at", { ascending: false })
    .limit(400);
  if (error || !data) return new Map();
  const map = new Map<string, HealthView>();
  for (const row of data as HealthView[]) {
    if (!map.has(row.provider_id)) map.set(row.provider_id, row);
  }
  return map;
}

/* -------------------------------------------------------------------- *
 * Overview
 * -------------------------------------------------------------------- */

export async function adminInfraOverview(): Promise<ServiceResult<{ overview: InfraOverview }>> {
  const [counts, pendingCount, failed, errors, health, credentials] = await Promise.all([
    Promise.all([
      supabaseAdmin.from("providers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("providers").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]),
    supabaseAdmin.from("provider_sync_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    countFailedSyncs(24),
    countProviderErrors({ sinceHours: 24 }),
    latestHealthByProvider(),
    listProviderCredentials(),
  ]);
  const [totalRow, activeRow] = counts;
  const total = totalRow.count ?? 0;
  const active = activeRow.count ?? 0;
  const pending = pendingCount.count ?? 0;

  let healthy = 0;
  let degraded = 0;
  let unavailable = 0;
  let totalResponse = 0;
  let measured = 0;
  for (const healthRow of health.values()) {
    if (healthRow.status === "healthy") healthy += 1;
    if (healthRow.status === "degraded") degraded += 1;
    if (healthRow.status === "unavailable") unavailable += 1;
    if (healthRow.response_time_ms != null) {
      totalResponse += healthRow.response_time_ms;
      measured += 1;
    }
  }

  const expiringCredentials = (credentials ?? []).filter((c) => {
    if (c.status !== "active" || !c.expiresAt) return false;
    const days = (new Date(c.expiresAt).getTime() - Date.now()) / 86400000;
    return days <= 14;
  }).length;

  return {
    ok: true,
    overview: {
      totalProviders: total,
      activeProviders: active,
      healthyProviders: healthy,
      degradedProviders: degraded,
      unavailableProviders: unavailable,
      pendingSyncs: pending,
      failedSyncs24h: failed,
      providerErrors24h: errors,
      avgResponseTimeMs: measured ? Math.round(totalResponse / measured) : null,
      expiringCredentials,
    },
  };
}

/* -------------------------------------------------------------------- *
 * Providers
 * -------------------------------------------------------------------- */

export async function adminListProviders(search?: string): Promise<ServiceResult<{ providers: AdminProviderView[] }>> {
  const query = supabaseAdmin.from("providers").select("*").order("sort", { ascending: true }).limit(200);
  const { data, error } = await query;
  if (error) {
    serverLogError("service:infra.listProviders", error);
    return fail(500, "Não foi possível listar os fornecedores.");
  }
  const health = await latestHealthByProvider();
  const rows = (data ?? []) as ProviderRow[];
  const filtered = search?.trim() ? rows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase())) : rows;
  return { ok: true, providers: filtered.map((row) => mapProviderView(row, health.get(row.id))) };
}

export async function adminGetProviderDetail(slug: string): Promise<ServiceResult<{ detail: ProviderDetail }>> {
  const { data: row, error } = await supabaseAdmin.from("providers").select("*").eq("slug", slug).maybeSingle();
  if (error || !row) return fail(404, "Fornecedor não encontrado.");

  const provider = row as ProviderRow;
  const [healthMap, resources, credentials, syncs, webhooks, activity, healthHistory] = await Promise.all([
    latestHealthByProvider(),
    supabaseAdmin.from("provider_resources").select("service_type, provider_id", { count: "exact", head: false }).eq("provider_id", provider.id),
    listProviderCredentials(provider.id),
    listSyncJobs({ providerId: provider.id, limit: 20 }),
    listWebhookEndpoints(provider.id),
    listProviderActivity({ providerId: provider.id, limit: 30 }),
    supabaseAdmin.from("provider_health_checks").select("provider_id, status, response_time_ms, error_class, error_message, checked_at").eq("provider_id", provider.id).order("checked_at", { ascending: false }).limit(20),
  ]);

  const resourcesByService = new Map<string, number>();
  for (const resource of resources.data ?? []) {
    const service = resource.service_type as string;
    resourcesByService.set(service, (resourcesByService.get(service) ?? 0) + 1);
  }

  return {
    ok: true,
    detail: {
      ...mapProviderView(provider, healthMap.get(provider.id)),
      resourcesByService: [...resourcesByService.entries()].map(([service, count]) => ({ service, count })),
      credentials,
      syncs,
      webhooks,
      activity,
      healthHistory: (healthHistory.data ?? []) as HealthView[],
    },
  };
}

export async function adminSaveProvider(
  input: { id: string; name?: string; apiEndpoint?: string | null; environment?: string },
  ctx: AdminActor,
): Promise<ServiceResult<{ ok: true }>> {
  const patch: Record<string, unknown> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (typeof input.apiEndpoint === "string" || input.apiEndpoint === null) {
    if (input.apiEndpoint && !/^https?:\/\//i.test(input.apiEndpoint)) return fail(400, "URL inválido.");
    patch.api_endpoint = input.apiEndpoint || null;
  }
  if (input.environment) {
    if (!["production", "staging", "development"].includes(input.environment)) return fail(400, "Ambiente inválido.");
    patch.environment = input.environment;
  }
  if (!Object.keys(patch).length) return fail(400, "Nada para atualizar.");

  const { error } = await supabaseAdmin.from("providers").update(patch).eq("id", input.id);
  if (error) {
    serverLogError("service:infra.saveProvider", error);
    return fail(500, "Não foi possível guardar o fornecedor.");
  }
  await logAudit({
    action: AUDIT.INFRA_PROVIDER_SAVED,
    entity: "provider",
    entityId: input.id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
    meta: { fields: Object.keys(patch) },
  });
  return { ok: true };
}

export async function adminSetProviderStatus(
  id: string,
  status: string,
  ctx: AdminActor,
): Promise<ServiceResult<{ ok: true }>> {
  if (!["active", "inactive", "maintenance", "degraded", "error", "unknown"].includes(status)) {
    return fail(400, "Estado inválido.");
  }
  const { error } = await supabaseAdmin.from("providers").update({ status: status as ProviderStatus }).eq("id", id);
  if (error) return fail(500, "Não foi possível alterar o estado.");

  await logAudit({
    action: AUDIT.INFRA_PROVIDER_STATUS,
    entity: "provider",
    entityId: id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
    meta: { status },
  });
  return { ok: true };
}

/* -------------------------------------------------------------------- *
 * Connection test + health
 * -------------------------------------------------------------------- */

export async function adminTestProviderConnection(
  id: string,
  ctx: AdminActor,
): Promise<ServiceResult<{ status: string; message: string }>> {
  const { data: row, error } = await supabaseAdmin.from("providers").select("id, slug, name").eq("id", id).maybeSingle();
  if (error || !row) return fail(404, "Fornecedor não encontrado.");

  const result = await checkProviderHealth(row.id);
  const label = PROVIDER_HEALTH_LABEL[result.status] ?? result.status;
  const message = result.errorMessage ?? label;

  await logAudit({
    action: AUDIT.INFRA_CONNECTION_TESTED,
    entity: "provider",
    entityId: id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
    meta: { status: result.status, message },
  });
  return { ok: true, status: result.status, message: `${label}. ${message}` };
}

export async function adminRunAllHealthChecks(ctx: AdminActor): Promise<ServiceResult<{ checked: number; degraded: number; unavailable: number }>> {
  const summary = await runHealthChecks();
  await logAudit({
    action: AUDIT.INFRA_CONNECTION_TESTED,
    entity: "infra",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
    meta: { scope: "all", ...summary },
  });
  return { ok: true, ...summary };
}

export async function adminListHealthChecks(providerId?: string): Promise<ServiceResult<{ checks: HealthView[] }>> {
  let query = supabaseAdmin
    .from("provider_health_checks")
    .select("provider_id, status, response_time_ms, error_class, error_message, checked_at")
    .order("checked_at", { ascending: false })
    .limit(100);
  if (providerId) query = query.eq("provider_id", providerId);
  const { data, error } = await query;
  if (error) return fail(500, "Não foi possível listar os health checks.");
  return { ok: true, checks: (data ?? []) as HealthView[] };
}

export async function adminProviderHealthFor(slug: string): Promise<HealthView | null> {
  const { data: provider, error } = await supabaseAdmin.from("providers").select("id").eq("slug", slug).maybeSingle();
  if (error || !provider) return null;
  return lastHealthCheck(provider.id as string);
}

/* -------------------------------------------------------------------- *
 * Credentials
 * -------------------------------------------------------------------- */

export async function adminAddCredential(
  input: { providerId: string; field: string; value: string; expiresAt?: string | null },
  ctx: AdminActor,
): Promise<ServiceResult<{ ok: true }>> {
  const field = input.field.trim();
  const value = input.value;
  if (!field || field.length > 64) return fail(400, "Nome da credencial inválido.");
  if (!value || value.length < 6) return fail(400, "A credencial tem de ter pelo menos 6 caracteres.");

  const { data: provider, error: providerError } = await supabaseAdmin.from("providers").select("id, slug").eq("id", input.providerId).maybeSingle();
  if (providerError || !provider) return fail(404, "Fornecedor não encontrado.");

  const storeRaw = await storeProviderCredential(input.providerId, field, value, {
    expiresAt: input.expiresAt ?? null,
    verify: true,
  });
  if (!storeRaw) return fail(500, "Não foi possível guardar a credencial.");

  await logAudit({
    action: AUDIT.INFRA_CREDENTIAL_ADDED,
    entity: "provider_credential",
    entityId: provider.id as string,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
    meta: { providerSlug: provider.slug, field },
  });
  return { ok: true };
}

export async function adminTestCredential(id: string, ctx: AdminActor): Promise<ServiceResult<{ ok: true; message: string }>> {
  const result = await vaultTestCredential(id);
  if (!result.ok) return fail(400, result.message);
  await logAudit({
    action: AUDIT.INFRA_CREDENTIAL_TESTED,
    entity: "provider_credential",
    entityId: id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
  });
  return { ok: true, message: result.message };
}

export async function adminRotateCredential(id: string, newValue: string, ctx: AdminActor): Promise<ServiceResult<{ ok: true }>> {
  if (!newValue || newValue.length < 6) return fail(400, "A credencial tem de ter pelo menos 6 caracteres.");
  const rotated = await vaultRotateCredential(id, newValue);
  if (!rotated) return fail(500, "Não foi possível rodar a credencial.");
  await logAudit({
    action: AUDIT.INFRA_CREDENTIAL_ROTATED,
    entity: "provider_credential",
    entityId: id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
  });
  return { ok: true };
}

export async function adminRevokeCredential(id: string, ctx: AdminActor): Promise<ServiceResult<{ ok: true }>> {
  const revoked = await vaultRevokeCredential(id);
  if (!revoked) return fail(500, "Não foi possível revogar a credencial.");
  await logAudit({
    action: AUDIT.INFRA_CREDENTIAL_REVOKED,
    entity: "provider_credential",
    entityId: id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
  });
  return { ok: true };
}

export async function adminListCredentials(providerId?: string): Promise<ServiceResult<{ credentials: SafeProviderCredential[] }>> {
  const credentials = await listProviderCredentials(providerId);
  return { ok: true, credentials };
}

async function credentialExpiryAlerts(): Promise<number> {
  const credentials = await listProviderCredentials();
  const now = Date.now();
  const expiring = credentials.filter((c) => c.status === "active" && c.expiresAt);
  let alerted = 0;
  for (const credential of expiring) {
    const days = (new Date(credential.expiresAt!).getTime() - now) / 86400000;
    if (days <= 14 && days >= 0) {
      alerted += 1;
      await notifyEvent(
        "infra.credential_expiring",
        {
          provider: credential.providerSlug ?? "fornecedor",
          field: credential.field,
          daysLeft: Math.ceil(days),
          expiresAt: new Date(credential.expiresAt!).toLocaleDateString("pt-PT"),
        },
        { channels: ["dashboard"] },
      );
    }
  }
  return alerted;
}

/* -------------------------------------------------------------------- *
 * Sync
 * -------------------------------------------------------------------- */

export async function adminRunSync(
  input: { providerId: string; service: SyncService },
  ctx: AdminActor,
): Promise<ServiceResult<{ ok: true; jobId?: string; message?: string }>> {
  const jobId = await enqueueSyncJob({ providerId: input.providerId, service: input.service, kind: "manual" });
  if (!jobId) return fail(500, "Não foi possível agendar a sincronização.");

  await logAudit({
    action: AUDIT.INFRA_SYNC_RUN,
    entity: "provider",
    entityId: input.providerId,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
    meta: { service: input.service, jobId },
  });

  // Run synchronously so the admin gets an immediate, truthful result.
  const result = await runSyncForProvider(input.providerId, input.service);
  return { ok: true, jobId, message: result.message };
}

export async function adminListSyncs(opts?: { providerId?: string; status?: string }): Promise<ServiceResult<{ syncs: SafeSyncJob[] }>> {
  const syncs = await listSyncJobs({
    providerId: opts?.providerId,
    status: (opts?.status ?? undefined) as SafeSyncJob["status"] | undefined,
    limit: 60,
  });
  return { ok: true, syncs };
}

export async function adminRunPendingSyncs(): Promise<{ processed: number; failed: number }> {
  return runPendingSyncJobs(10);
}

/* -------------------------------------------------------------------- *
 * Webhooks
 * -------------------------------------------------------------------- */

export async function adminListWebhooks(providerId?: string): Promise<ServiceResult<{ webhooks: SafeWebhookEndpoint[] }>> {
  const webhooks = await listWebhookEndpoints(providerId);
  return { ok: true, webhooks };
}

export async function adminSaveWebhook(
  input: { id?: string; providerId?: string | null; service: string; name: string; url: string; events?: string[]; status?: string; secret?: string; generateSecret?: boolean },
  ctx: AdminActor,
): Promise<ServiceResult<{ id?: string; secret?: string }>> {
  const generateSecret = input.generateSecret === true && !input.secret;
  const secretValue = input.secret ?? (generateSecret ? newWebhookSecret() : undefined);

  const saved = await saveWebhookEndpoint({
    id: input.id,
    providerId: input.providerId ?? null,
    service: input.service,
    name: input.name,
    url: input.url,
    secret: generateSecret ? secretValue : input.secret,
    events: input.events,
    status: input.status,
  });
  if (!saved.ok) return fail(400, saved.error ?? "Não foi possível guardar o webhook.");

  await logAudit({
    action: input.id ? AUDIT.INFRA_WEBHOOK_SAVED : AUDIT.INFRA_WEBHOOK_SAVED,
    entity: "provider_webhook",
    entityId: saved.id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
    meta: { service: input.service, generatedSecret: generateSecret },
  });
  // The freshly generated secret is returned exactly once so the operator can
  // store it at the endpoint; it is not persisted in plaintext anywhere.
  return generateSecret ? { ok: true, id: saved.id, secret: secretValue } : { ok: true, id: saved.id };
}

export async function adminDeleteWebhook(id: string, ctx: AdminActor): Promise<ServiceResult<{ ok: true }>> {
  const removed = await deleteWebhookEndpoint(id);
  if (!removed) return fail(500, "Não foi possível remover o webhook.");
  await logAudit({
    action: AUDIT.INFRA_WEBHOOK_DELETED,
    entity: "provider_webhook",
    entityId: id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
  });
  return { ok: true };
}

export async function adminTestWebhook(id: string, ctx: AdminActor): Promise<ServiceResult<{ ok: true; message: string }>> {
  const result = await vaultTestWebhook(id);
  if (!result.ok) return fail(400, result.message);
  await logAudit({
    action: AUDIT.INFRA_WEBHOOK_TESTED,
    entity: "provider_webhook",
    entityId: id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip: ctx.ip,
  });
  return { ok: true, message: result.message };
}

/* -------------------------------------------------------------------- *
 * Activity / events
 * -------------------------------------------------------------------- */

export async function adminListActivity(providerId?: string): Promise<ServiceResult<{ activity: SafeActivityLog[] }>> {
  const activity = await listProviderActivity({ providerId, limit: 100 });
  return { ok: true, activity };
}

export async function adminListEvents(status?: string): Promise<ServiceResult<{ events: unknown[] }>> {
  const events = await listInboundEvents({ status: status || undefined, limit: 60 });
  return { ok: true, events };
}

export { credentialExpiryAlerts as adminCredentialExpiryAlerts };