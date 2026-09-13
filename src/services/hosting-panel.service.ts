import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { selectHostingProvider } from "@/lib/provisioning/hosting/registry";
import type { HostingCapability } from "@/lib/provisioning/hosting/types";
import type { AuthContext } from "@/lib/client";
import { encryptSecret, randomStrongPassword } from "@/lib/provisioning/credentials";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";
import { enqueueProvisioningJob } from "@/lib/provisioning/jobs";
import { fail, type ServiceResult } from "./result";

/* --------------------------------------------------------------------- *
 * Types (panel-shaped projections of the hosting_* tables)
 * --------------------------------------------------------------------- */

export type PanelCapability = HostingCapability;

export type ProviderInfo = {
  id: string;
  label: string;
  mode: "live" | "simulated";
  capabilities: PanelCapability[];
};

export type HostingPanelAccount = {
  id: string;
  domain: string | null;
  username: string | null;
  status: string;
  panelUrl: string | null;
  serverIp: string | null;
  nameservers: unknown[];
  quotaGb: number;
  provisionedAt: string | null;
  renewsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type HostingPanelPlan = {
  id: string;
  name: string;
  storageGb: number;
  bandwidthGb: number;
  sites: number;
  emailAccounts: number;
  databases: number;
  cpuCores: number;
  memoryMb: number;
  backups: number;
  inodes: number;
  phpVersions: string[];
  priceMonthly: number;
  priceQuarterly: number;
  priceSemiannual: number;
  priceYearly: number;
  currency: string;
  features: unknown;
};

export type HostingUsage = {
  id: string;
  measuredAt: string;
  storageMb: number;
  bandwidthMb: number;
  inodes: number;
  cpuPercent: number;
  memoryPercent: number;
  sites: number;
  databases: number;
  emailAccounts: number;
};

export type HostingWebsite = {
  id: string;
  hostingAccountId: string;
  domain: string;
  status: string;
  app: string | null;
  phpVersion: string | null;
  sslStatus: string;
  sslExpiresAt: string | null;
  documentRoot: string | null;
  storageMb: number;
  lastBackupAt: string | null;
  createdAt: string;
};

export type HostingDatabase = {
  id: string;
  hostingAccountId: string;
  name: string;
  engine: string;
  sizeMb: number;
  dbUser: string | null;
  status: string;
  createdAt: string;
};

export type HostingBackup = {
  id: string;
  hostingAccountId: string;
  kind: string;
  label: string;
  sizeMb: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type HostingSslCertificate = {
  id: string;
  hostingAccountId: string;
  domain: string;
  provider: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  createdAt: string;
};

export type HostingCronJob = {
  id: string;
  hostingAccountId: string;
  command: string;
  schedule: string;
  status: string;
  lastRunAt: string | null;
  createdAt: string;
};

export type ResourceAlert = {
  id: string;
  hostingAccountId: string;
  kind: string;
  level: string;
  message: string;
  status: string;
  createdAt: string;
  ackedAt: string | null;
};

export type HostingActivityEntry = {
  action: string;
  actorEmail: string | null;
  createdAt: string;
};

export type SecurityCheck = { id: string; label: string; ok: boolean; detail?: string };

export type HostingSecurityReport = { score: number; checks: SecurityCheck[] };

export type PerformanceMetric = { label: string; value: string; tone: "ok" | "warn" | "danger" };

export type HostingPerformanceReport = { score: number; metrics: PerformanceMetric[]; recommendations: string[] };

export type HostingOverview = {
  account: HostingPanelAccount;
  plan: HostingPanelPlan | null;
  provider: ProviderInfo;
  usage: HostingUsage | null;
  usagePercent: { storage: number | null; bandwidth: number | null; inodes: number | null };
  counts: { websites: number; databases: number; backups: number; ssl: number; alerts: number; cron: number };
  latestActivity: HostingActivityEntry | null;
};

/* --------------------------------------------------------------------- *
 * Row shapes
 * --------------------------------------------------------------------- */

type AccountRow = {
  id: string;
  domain: string | null;
  username: string | null;
  status: string;
  panel_url: string | null;
  server_ip: string | null;
  nameservers: unknown[] | null;
  quota_gb: number | null;
  plan_id: string | null;
  order_id: string | null;
  provisioned_at: string | null;
  renews_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const FULL_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{2,20})+$/i;
const DB_NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;
const SCHEDULE_RE = /^(\*|[0-9]{1,2}|[0-9]{1,2}-[0-9]{1,2}|\*\/[0-9]{1,2})( (\*|[0-9]{1,2}|[0-9]{1,2}-[0-9]{1,2}|\*\/[0-9]{1,2})){4}$/;

/* --------------------------------------------------------------------- *
 * Helpers
 * --------------------------------------------------------------------- */

function providerInfo(): ProviderInfo {
  const sel = selectHostingProvider();
  return {
    id: sel.provider.id,
    label: sel.provider.label,
    mode: sel.mode,
    capabilities: [...sel.provider.capabilities],
  };
}

function percent(used: number, limit: number): number | null {
  if (!limit || limit <= 0) return null;
  return Math.min(200, Math.round((used / limit) * 100));
}

async function getOwnedAccount(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ account: AccountRow }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");
  const { data } = await supabaseAdmin
    .from("hosting_accounts")
    .select("*")
    .eq("id", hostingId)
    .eq("customer_id", ctx.userId)
    .maybeSingle();
  if (!data) return fail(404, "Conta de alojamento não encontrada.");
  return { ok: true, account: data as AccountRow };
}

/** Guards the action with ownership + provider capability. */
async function guardPanel(
  ctx: AuthContext,
  hostingId: string,
  capability: PanelCapability,
): Promise<ServiceResult<{ account: AccountRow; provider: ProviderInfo }>> {
  const owned = await getOwnedAccount(ctx, hostingId);
  if (!owned.ok) return owned;
  const provider = providerInfo();
  if (!provider.capabilities.includes(capability)) {
    return fail(409, "Funcionalidade não incluída no teu plano/provedor.");
  }
  return { ok: true, account: owned.account, provider };
}

async function loadPlan(planId: string | null | undefined): Promise<HostingPanelPlan | null> {
  if (!planId) return null;
  const { data } = await supabaseAdmin.from("hosting_plans").select("*").eq("id", planId).maybeSingle();
  if (!data) return null;
  let php: string[] = [];
  if (typeof data.php_versions === "string") {
    try {
      const parsed = JSON.parse(data.php_versions);
      if (Array.isArray(parsed)) php = parsed.map(String);
    } catch {
      php = [];
    }
  } else if (Array.isArray(data.php_versions)) {
    php = data.php_versions.map(String);
  }
  return {
    id: data.id,
    name: String(data.name ?? ""),
    storageGb: Number(data.storage_gb ?? 0),
    bandwidthGb: Number(data.bandwidth_gb ?? 0),
    sites: Number(data.sites ?? 0),
    emailAccounts: Number(data.email_accounts ?? 0),
    databases: Number(data.databases ?? 0),
    cpuCores: Number(data.cpu_cores ?? 1),
    memoryMb: Number(data.memory_mb ?? 2048),
    backups: Number(data.backups ?? 1),
    inodes: Number(data.inodes ?? 250000),
    phpVersions: php.length ? php : ["8.3", "8.2", "8.1"],
    priceMonthly: Number(data.price_monthly ?? 0),
    priceQuarterly: Number(data.price_quarterly ?? 0),
    priceSemiannual: Number(data.price_semiannual ?? 0),
    priceYearly: Number(data.price_yearly ?? 0),
    currency: String(data.currency ?? "MZN"),
    features: data.features ?? [],
  };
}

function accountShape(row: AccountRow): HostingPanelAccount {
  return {
    id: row.id,
    domain: row.domain,
    username: row.username,
    status: row.status,
    panelUrl: row.panel_url,
    serverIp: row.server_ip,
    nameservers: row.nameservers ?? [],
    quotaGb: row.quota_gb ?? 0,
    provisionedAt: row.provisioned_at,
    renewsAt: row.renews_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

async function latestUsage(hostingId: string): Promise<HostingUsage | null> {
  const { data } = await supabaseAdmin
    .from("hosting_usage")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    measuredAt: data.measured_at,
    storageMb: Number(data.storage_mb ?? 0),
    bandwidthMb: Number(data.bandwidth_mb ?? 0),
    inodes: Number(data.inodes ?? 0),
    cpuPercent: Number(data.cpu_percent ?? 0),
    memoryPercent: Number(data.memory_percent ?? 0),
    sites: Number(data.sites ?? 0),
    databases: Number(data.databases ?? 0),
    emailAccounts: Number(data.email_accounts ?? 0),
  };
}

async function listCounts(hostingId: string): Promise<{
  websites: number;
  databases: number;
  backups: number;
  ssl: number;
  alerts: number;
  cron: number;
}> {
  const [websites, databases, backups, ssl, alerts, cron] = await Promise.all([
    supabaseAdmin.from("hosting_websites").select("id", { count: "exact", head: true }).eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_databases").select("id", { count: "exact", head: true }).eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_backups").select("id", { count: "exact", head: true }).eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_ssl_certificates").select("id", { count: "exact", head: true }).eq("hosting_account_id", hostingId),
    supabaseAdmin.from("resource_alerts").select("id", { count: "exact", head: true }).eq("hosting_account_id", hostingId).eq("status", "open"),
    supabaseAdmin.from("hosting_cron_jobs").select("id", { count: "exact", head: true }).eq("hosting_account_id", hostingId),
  ]);
  return {
    websites: websites.count ?? 0,
    databases: databases.count ?? 0,
    backups: backups.count ?? 0,
    ssl: ssl.count ?? 0,
    alerts: alerts.count ?? 0,
    cron: cron.count ?? 0,
  };
}

async function latestActivity(hostingId: string): Promise<HostingActivityEntry | null> {
  const { data } = await supabaseAdmin
    .from("audit_logs")
    .select("action, actor_email, created_at")
    .eq("entity", "hosting_account")
    .eq("entity_id", hostingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { action: data.action, actorEmail: data.actor_email ?? null, createdAt: data.created_at };
}

async function panelAudit(
  action: string,
  hostingId: string,
  ctx: AuthContext,
  meta?: Record<string, unknown>,
): Promise<void> {
  await logAudit({
    action,
    entity: "hosting_account",
    entityId: hostingId,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: "customer",
    meta: meta ?? {},
  });
}

/* --------------------------------------------------------------------- *
 * Account ownership
 * --------------------------------------------------------------------- */

export async function userOwnsHostingAccount(ctx: AuthContext, hostingId: string): Promise<boolean> {
  const owned = await getOwnedAccount(ctx, hostingId);
  return owned.ok;
}

/* --------------------------------------------------------------------- *
 * Overview
 * --------------------------------------------------------------------- */

export async function getHostingOverview(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ overview: HostingOverview }>> {
  const owned = await getOwnedAccount(ctx, hostingId);
  if (!owned.ok) return owned;
  const { account } = owned;
  const provider = providerInfo();
  const [plan, usage, counts, activity] = await Promise.all([
    loadPlan(account.plan_id),
    latestUsage(hostingId),
    listCounts(hostingId),
    latestActivity(hostingId),
  ]);
  const usedStorage = usage ? usage.storageMb : 0;
  const usedBandwidth = usage ? usage.bandwidthMb : 0;
  return {
    ok: true,
    overview: {
      account: accountShape(account),
      plan,
      provider,
      usage,
      usagePercent: {
        storage: percent(usedStorage, (plan?.storageGb ?? 0) * 1024),
        bandwidth: percent(usedBandwidth, (plan?.bandwidthGb ?? 0) * 1024),
        inodes: usage && plan ? percent(usage.inodes, plan.inodes) : null,
      },
      counts,
      latestActivity: activity,
    },
  };
}

/* --------------------------------------------------------------------- *
 * Usage
 * --------------------------------------------------------------------- */

export async function getUsage(
  ctx: AuthContext,
  hostingId: string,
): Promise<ServiceResult<{ usage: HostingUsage | null; history: HostingUsage[] }>> {
  const guarded = await guardPanel(ctx, hostingId, "usage");
  if (!guarded.ok) return guarded;
  const { data } = await supabaseAdmin
    .from("hosting_usage")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("measured_at", { ascending: false })
    .limit(30);
  const history = (data ?? []).map((u) => ({
    id: u.id,
    measuredAt: u.measured_at,
    storageMb: Number(u.storage_mb ?? 0),
    bandwidthMb: Number(u.bandwidth_mb ?? 0),
    inodes: Number(u.inodes ?? 0),
    cpuPercent: Number(u.cpu_percent ?? 0),
    memoryPercent: Number(u.memory_percent ?? 0),
    sites: Number(u.sites ?? 0),
    databases: Number(u.databases ?? 0),
    emailAccounts: Number(u.email_accounts ?? 0),
  }));
  return { ok: true, usage: history[0] ?? null, history };
}

/** Computes a usage snapshot from the platform-managed state (websites, dbs, ssl). */
async function computeUsageSnapshot(hostingId: string) {
  const [{ data: websites }, { data: databases }, { data: backups }] = await Promise.all([
    supabaseAdmin.from("hosting_websites").select("storage_mb").eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_databases").select("size_mb").eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_backups").select("size_mb").eq("hosting_account_id", hostingId),
  ]);
  const storageMb =
    (websites ?? []).reduce((sum, w) => sum + Number(w.storage_mb ?? 0), 0) +
    (databases ?? []).reduce((sum, d) => sum + Number(d.size_mb ?? 0), 0) +
    (backups ?? []).reduce((sum, b) => sum + Number(b.size_mb ?? 0), 0);
  return {
    storage_mb: storageMb,
    bandwidth_mb: 0,
    inodes: (websites ?? []).length * 5000,
    cpu_percent: 0,
    memory_percent: 0,
    sites: (websites ?? []).length,
    databases: (databases ?? []).length,
    email_accounts: 0,
  };
}

export async function refreshUsage(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ usage: HostingUsage }>> {
  const guarded = await guardPanel(ctx, hostingId, "usage");
  if (!guarded.ok) return guarded;
  const snapshot = await computeUsageSnapshot(hostingId);
  const { data, error } = await supabaseAdmin
    .from("hosting_usage")
    .insert({ hosting_account_id: hostingId, ...snapshot })
    .select()
    .single();
  if (error || !data) {
    serverLogError("service:hosting-panel.refreshUsage", error ?? new Error("usage insert returned no row"));
    return fail(500, "Não foi possível atualizar o uso.");
  }
  await panelAudit(AUDIT.HOSTING_SYNC, hostingId, ctx, { action: "usage" });
  return {
    ok: true,
    usage: {
      id: data.id,
      measuredAt: data.measured_at,
      storageMb: Number(data.storage_mb ?? 0),
      bandwidthMb: Number(data.bandwidth_mb ?? 0),
      inodes: Number(data.inodes ?? 0),
      cpuPercent: Number(data.cpu_percent ?? 0),
      memoryPercent: Number(data.memory_percent ?? 0),
      sites: Number(data.sites ?? 0),
      databases: Number(data.databases ?? 0),
      emailAccounts: Number(data.email_accounts ?? 0),
    },
  };
}

/* --------------------------------------------------------------------- *
 * Websites
 * --------------------------------------------------------------------- */

function websiteShape(row: Record<string, unknown>): HostingWebsite {
  return {
    id: String(row.id),
    hostingAccountId: String(row.hosting_account_id),
    domain: String(row.domain ?? ""),
    status: String(row.status ?? "online"),
    app: row.app ? String(row.app) : null,
    phpVersion: row.php_version ? String(row.php_version) : null,
    sslStatus: String(row.ssl_status ?? "none"),
    sslExpiresAt: row.ssl_expires_at ? String(row.ssl_expires_at) : null,
    documentRoot: row.document_root ? String(row.document_root) : null,
    storageMb: Number(row.storage_mb ?? 0),
    lastBackupAt: row.last_backup_at ? String(row.last_backup_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listWebsites(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ websites: HostingWebsite[] }>> {
  const guarded = await guardPanel(ctx, hostingId, "websites");
  if (!guarded.ok) return guarded;
  const { data } = await supabaseAdmin
    .from("hosting_websites")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("created_at", { ascending: true });
  return { ok: true, websites: (data ?? []).map(websiteShape) };
}

export async function createWebsite(
  ctx: AuthContext,
  hostingId: string,
  input: { domain: string; app?: string; phpVersion?: string; documentRoot?: string; storageMb?: number },
): Promise<ServiceResult<{ website: HostingWebsite }>> {
  const guarded = await guardPanel(ctx, hostingId, "websites");
  if (!guarded.ok) return guarded;
  const domain = input.domain.trim().toLowerCase();
  if (!FULL_DOMAIN_RE.test(domain)) return fail(400, "Domínio inválido.");

  const plan = await loadPlan(guarded.account.plan_id);
  const { count } = await supabaseAdmin
    .from("hosting_websites")
    .select("id", { count: "exact", head: true })
    .eq("hosting_account_id", hostingId);
  if (plan && plan.sites > 0 && (count ?? 0) >= plan.sites) {
    return fail(409, `Limite de ${plan.sites} site(s) do plano atingido.`);
  }

  const phpVersion = input.phpVersion ? validatePhp(plan, input.phpVersion) : null;
  const { data, error } = await supabaseAdmin
    .from("hosting_websites")
    .insert({
      hosting_account_id: hostingId,
      domain,
      app: input.app?.trim() || null,
      php_version: phpVersion,
      document_root: input.documentRoot?.trim() || null,
      storage_mb: Math.max(0, Math.floor(Number(input.storageMb ?? 0))),
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, "Esse domínio já existe na conta.");
    serverLogError("service:hosting-panel.createWebsite", error);
    return fail(500, "Não foi possível criar o website.");
  }
  await panelAudit(AUDIT.HOSTING_WEBSITE_CREATED, hostingId, ctx, { domain });
  await notifyEvent("hosting.website.created", { domain, accountDomain: guarded.account.domain }, { channels: ["dashboard"] });
  return { ok: true, website: websiteShape(data) };
}

export async function updateWebsite(
  ctx: AuthContext,
  hostingId: string,
  websiteId: string,
  patch: { app?: string; status?: string; documentRoot?: string; storageMb?: number },
): Promise<ServiceResult<{ website: HostingWebsite }>> {
  const guarded = await guardPanel(ctx, hostingId, "websites");
  if (!guarded.ok) return guarded;
  const update: Record<string, unknown> = {};
  if (patch.app !== undefined) update.app = patch.app.trim() || null;
  if (patch.status !== undefined) {
    if (!["online", "offline", "suspended", "error"].includes(patch.status)) return fail(400, "Estado inválido.");
    update.status = patch.status;
  }
  if (patch.documentRoot !== undefined) update.document_root = patch.documentRoot.trim() || null;
  if (patch.storageMb !== undefined) update.storage_mb = Math.max(0, Math.floor(Number(patch.storageMb)));
  if (!Object.keys(update).length) return fail(400, "Nada para atualizar.");

  const { data, error } = await supabaseAdmin
    .from("hosting_websites")
    .update(update)
    .eq("id", websiteId)
    .eq("hosting_account_id", hostingId)
    .select()
    .single();
  if (error || !data) return fail(404, "Website não encontrado.");
  await panelAudit(AUDIT.HOSTING_WEBSITE_UPDATED, hostingId, ctx, { websiteId });
  return { ok: true, website: websiteShape(data) };
}

export async function deleteWebsite(ctx: AuthContext, hostingId: string, websiteId: string): Promise<ServiceResult<{ ok: true }>> {
  const guarded = await guardPanel(ctx, hostingId, "websites");
  if (!guarded.ok) return guarded;
  const { data, error } = await supabaseAdmin
    .from("hosting_websites")
    .delete()
    .eq("id", websiteId)
    .eq("hosting_account_id", hostingId)
    .select("domain")
    .single();
  if (error || !data) return fail(404, "Website não encontrado.");
  await panelAudit(AUDIT.HOSTING_WEBSITE_DELETED, hostingId, ctx, { websiteId, domain: data.domain });
  return { ok: true };
}

function validatePhp(plan: HostingPanelPlan | null, version: string): string {
  const clean = version.trim();
  if (clean && plan && plan.phpVersions.includes(clean)) return clean;
  if (clean && /^\d+\.\d+$/.test(clean)) return clean;
  return plan?.phpVersions[0] ?? "8.3";
}

export async function setWebsitePhp(
  ctx: AuthContext,
  hostingId: string,
  websiteId: string,
  phpVersion: string,
): Promise<ServiceResult<{ website: HostingWebsite }>> {
  const guarded = await guardPanel(ctx, hostingId, "php");
  if (!guarded.ok) return guarded;
  const plan = await loadPlan(guarded.account.plan_id);
  const version = validatePhp(plan, phpVersion);
  if (plan && !plan.phpVersions.includes(version)) return fail(400, "Versão de PHP não suportada neste plano.");
  const { data, error } = await supabaseAdmin
    .from("hosting_websites")
    .update({ php_version: version })
    .eq("id", websiteId)
    .eq("hosting_account_id", hostingId)
    .select()
    .single();
  if (error || !data) return fail(404, "Website não encontrado.");
  await panelAudit(AUDIT.HOSTING_PHP_CHANGED, hostingId, ctx, { websiteId, phpVersion: version });
  return { ok: true, website: websiteShape(data) };
}

/* --------------------------------------------------------------------- *
 * Databases
 * --------------------------------------------------------------------- */

function databaseShape(row: Record<string, unknown>): HostingDatabase {
  return {
    id: String(row.id),
    hostingAccountId: String(row.hosting_account_id),
    name: String(row.name ?? ""),
    engine: String(row.engine ?? "mysql"),
    sizeMb: Number(row.size_mb ?? 0),
    dbUser: row.db_user ? String(row.db_user) : null,
    status: String(row.status ?? "active"),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listDatabases(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ databases: HostingDatabase[] }>> {
  const guarded = await guardPanel(ctx, hostingId, "databases");
  if (!guarded.ok) return guarded;
  const { data } = await supabaseAdmin
    .from("hosting_databases")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("created_at", { ascending: true });
  return { ok: true, databases: (data ?? []).map(databaseShape) };
}

export async function createDatabase(
  ctx: AuthContext,
  hostingId: string,
  input: { name: string; engine?: string },
): Promise<ServiceResult<{ database: HostingDatabase; password: string }>> {
  const guarded = await guardPanel(ctx, hostingId, "databases");
  if (!guarded.ok) return guarded;
  const name = input.name.trim().toLowerCase();
  if (!DB_NAME_RE.test(name)) return fail(400, "Nome de base de dados inválido (a-z, 0-9, _).");

  const plan = await loadPlan(guarded.account.plan_id);
  const { count } = await supabaseAdmin
    .from("hosting_databases")
    .select("id", { count: "exact", head: true })
    .eq("hosting_account_id", hostingId);
  if (plan && plan.databases > 0 && (count ?? 0) >= plan.databases) {
    return fail(409, `Limite de ${plan.databases} base(s) de dados do plano atingido.`);
  }

  const password = randomStrongPassword();
  const dbUser = [name].join("_").replace(/[^a-z0-9_]/g, "").slice(0, 16);
  const { data, error } = await supabaseAdmin
    .from("hosting_databases")
    .insert({
      hosting_account_id: hostingId,
      name,
      engine: input.engine === "postgresql" ? "postgresql" : "mysql",
      db_user: dbUser,
      password_cipher: encryptSecret(password),
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, "Essa base de dados já existe na conta.");
    serverLogError("service:hosting-panel.createDatabase", error);
    return fail(500, "Não foi possível criar a base de dados.");
  }
  await panelAudit(AUDIT.HOSTING_DATABASE_CREATED, hostingId, ctx, { name });
  return { ok: true, database: databaseShape(data), password };
}

export async function deleteDatabase(ctx: AuthContext, hostingId: string, databaseId: string): Promise<ServiceResult<{ ok: true }>> {
  const guarded = await guardPanel(ctx, hostingId, "databases");
  if (!guarded.ok) return guarded;
  const { data, error } = await supabaseAdmin
    .from("hosting_databases")
    .delete()
    .eq("id", databaseId)
    .eq("hosting_account_id", hostingId)
    .select("name")
    .single();
  if (error || !data) return fail(404, "Base de dados não encontrada.");
  await panelAudit(AUDIT.HOSTING_DATABASE_DELETED, hostingId, ctx, { name: data.name });
  return { ok: true };
}

export async function resetDatabasePassword(
  ctx: AuthContext,
  hostingId: string,
  databaseId: string,
): Promise<ServiceResult<{ password: string }>> {
  const guarded = await guardPanel(ctx, hostingId, "databases");
  if (!guarded.ok) return guarded;
  const password = randomStrongPassword();
  const { data, error } = await supabaseAdmin
    .from("hosting_databases")
    .update({ password_cipher: encryptSecret(password) })
    .eq("id", databaseId)
    .eq("hosting_account_id", hostingId)
    .select("name")
    .single();
  if (error || !data) return fail(404, "Base de dados não encontrada.");
  await panelAudit(AUDIT.HOSTING_DATABASE_PASSWORD_RESET, hostingId, ctx, { name: data.name });
  return { ok: true, password };
}

/* --------------------------------------------------------------------- *
 * Backups
 * --------------------------------------------------------------------- */

function backupShape(row: Record<string, unknown>): HostingBackup {
  return {
    id: String(row.id),
    hostingAccountId: String(row.hosting_account_id),
    kind: String(row.kind ?? "full"),
    label: String(row.label ?? "Backup"),
    sizeMb: Number(row.size_mb ?? 0),
    status: String(row.status ?? "queued"),
    createdAt: String(row.created_at ?? ""),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export async function listBackups(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ backups: HostingBackup[] }>> {
  const guarded = await guardPanel(ctx, hostingId, "backups");
  if (!guarded.ok) return guarded;
  const { data } = await supabaseAdmin
    .from("hosting_backups")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("created_at", { ascending: false });
  return { ok: true, backups: (data ?? []).map(backupShape) };
}

async function captureSnapshot(hostingId: string) {
  const [{ data: websites }, { data: databases }] = await Promise.all([
    supabaseAdmin.from("hosting_websites").select("id, domain, status, app, php_version, ssl_status, ssl_expires_at, document_root, storage_mb").eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_databases").select("id, name, engine, size_mb, db_user, status").eq("hosting_account_id", hostingId),
  ]);
  return {
    websites: websites ?? [],
    databases: databases ?? [],
    capturedAt: new Date().toISOString(),
  };
}

export async function createBackup(
  ctx: AuthContext,
  hostingId: string,
  input: { label?: string; kind?: string },
): Promise<ServiceResult<{ backup: HostingBackup }>> {
  const guarded = await guardPanel(ctx, hostingId, "backups");
  if (!guarded.ok) return guarded;
  const plan = await loadPlan(guarded.account.plan_id);
  const { count } = await supabaseAdmin
    .from("hosting_backups")
    .select("id", { count: "exact", head: true })
    .eq("hosting_account_id", hostingId)
    .eq("status", "completed");
  if (plan && plan.backups > 0 && (count ?? 0) >= plan.backups) {
    return fail(409, `Limite de ${plan.backups} backup(s) retidos no plano atingido.`);
  }

  const kind = input.kind && ["full", "website", "database", "files", "automatic"].includes(input.kind) ? input.kind : "full";
  const snapshot = await captureSnapshot(hostingId);
  const sizeMb = snapshot.websites.reduce((s, w) => s + Number(w.storage_mb ?? 0), 0) +
    snapshot.databases.reduce((s, d) => s + Number(d.size_mb ?? 0), 0);

  const { data, error } = await supabaseAdmin
    .from("hosting_backups")
    .insert({
      hosting_account_id: hostingId,
      kind,
      label: input.label?.trim() || (kind === "automatic" ? "Backup automático" : "Backup manual"),
      size_mb: Math.max(0, Math.floor(sizeMb)),
      status: "processing",
      snapshot,
    })
    .select()
    .single();
  if (error) {
    serverLogError("service:hosting-panel.createBackup", error);
    return fail(500, "Não foi possível criar o backup.");
  }

  const now = new Date().toISOString();
  const { data: done, error: doneErr } = await supabaseAdmin
    .from("hosting_backups")
    .update({ status: "completed", completed_at: now })
    .eq("id", data.id)
    .select()
    .single();
  if (doneErr || !done) {
    serverLogError("service:hosting-panel.createBackup.complete", doneErr ?? new Error("backup complete returned no row"));
  }

  await Promise.all(
    snapshot.websites.map((w) =>
      supabaseAdmin.from("hosting_websites").update({ last_backup_at: now }).eq("id", w.id).eq("hosting_account_id", hostingId),
    ),
  );

  await panelAudit(AUDIT.HOSTING_BACKUP_CREATED, hostingId, ctx, { kind, label: data.label });
  await notifyEvent("hosting.backup.completed", { domain: guarded.account.domain, label: data.label, sizeMb: Number(data.size_mb) }, { channels: ["dashboard"] });
  return { ok: true, backup: backupShape(done ?? data) };
}

export async function restoreBackup(ctx: AuthContext, hostingId: string, backupId: string): Promise<ServiceResult<{ ok: true }>> {
  const guarded = await guardPanel(ctx, hostingId, "backups");
  if (!guarded.ok) return guarded;
  const { data, error } = await supabaseAdmin
    .from("hosting_backups")
    .select("snapshot, label, status")
    .eq("id", backupId)
    .eq("hosting_account_id", hostingId)
    .maybeSingle();
  if (error || !data) return fail(404, "Backup não encontrado.");
  if (data.status !== "completed") return fail(409, "O backup ainda não está concluído.");

  const snap = data.snapshot as { websites?: Array<Record<string, unknown>>; databases?: Array<Record<string, unknown>> } | null;
  if (!snap) return fail(409, "O backup não contém dados para restaurar.");

  await supabaseAdmin.from("hosting_backups").update({ status: "restoring" }).eq("id", backupId);

  const now = new Date().toISOString();
  const websites = snap.websites ?? [];
  for (const site of websites) {
    await supabaseAdmin.from("hosting_websites").upsert(
      {
        id: site.id ? String(site.id) : undefined,
        hosting_account_id: hostingId,
        domain: String(site.domain),
        status: String(site.status ?? "online"),
        app: site.app ? String(site.app) : null,
        php_version: site.php_version ? String(site.php_version) : null,
        ssl_status: String(site.ssl_status ?? "none"),
        ssl_expires_at: site.ssl_expires_at ? String(site.ssl_expires_at) : null,
        document_root: site.document_root ? String(site.document_root) : null,
        storage_mb: Number(site.storage_mb ?? 0),
        updated_at: now,
      },
      { onConflict: "id" },
    );
  }
  const databases = snap.databases ?? [];
  for (const db of databases) {
    await supabaseAdmin.from("hosting_databases").upsert(
      {
        id: db.id ? String(db.id) : undefined,
        hosting_account_id: hostingId,
        name: String(db.name),
        engine: String(db.engine ?? "mysql"),
        size_mb: Number(db.size_mb ?? 0),
        db_user: db.db_user ? String(db.db_user) : null,
        status: String(db.status ?? "active"),
        updated_at: now,
      },
      { onConflict: "id" },
    );
  }

  await supabaseAdmin.from("hosting_backups").update({ status: "completed", completed_at: now }).eq("id", backupId);
  await panelAudit(AUDIT.HOSTING_BACKUP_RESTORED, hostingId, ctx, { backupId, label: data.label });
  return { ok: true };
}

export async function deleteBackup(ctx: AuthContext, hostingId: string, backupId: string): Promise<ServiceResult<{ ok: true }>> {
  const guarded = await guardPanel(ctx, hostingId, "backups");
  if (!guarded.ok) return guarded;
  const { data, error } = await supabaseAdmin
    .from("hosting_backups")
    .delete()
    .eq("id", backupId)
    .eq("hosting_account_id", hostingId)
    .select("label")
    .single();
  if (error || !data) return fail(404, "Backup não encontrado.");
  await panelAudit(AUDIT.HOSTING_BACKUP_DELETED, hostingId, ctx, { label: data.label });
  return { ok: true };
}

/* --------------------------------------------------------------------- *
 * SSL
 * --------------------------------------------------------------------- */

function sslShape(row: Record<string, unknown>): HostingSslCertificate {
  return {
    id: String(row.id),
    hostingAccountId: String(row.hosting_account_id),
    domain: String(row.domain ?? ""),
    provider: String(row.provider ?? "letsencrypt"),
    status: String(row.status ?? "pending"),
    issuedAt: row.issued_at ? String(row.issued_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    autoRenew: Boolean(row.auto_renew ?? true),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listSsl(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ certificates: HostingSslCertificate[] }>> {
  const guarded = await guardPanel(ctx, hostingId, "ssl");
  if (!guarded.ok) return guarded;
  const { data } = await supabaseAdmin
    .from("hosting_ssl_certificates")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("created_at", { ascending: false });
  return { ok: true, certificates: (data ?? []).map(sslShape) };
}

function sslExpiry(now: Date): { parsed: Date; expiresAt: string } {
  const expires = new Date(now.getTime());
  expires.setUTCDate(expires.getUTCDate() + 90);
  return { parsed: expires, expiresAt: expires.toISOString() };
}

export async function installSsl(
  ctx: AuthContext,
  hostingId: string,
  input: { domain: string; provider?: string },
): Promise<ServiceResult<{ certificate: HostingSslCertificate }>> {
  const guarded = await guardPanel(ctx, hostingId, "ssl");
  if (!guarded.ok) return guarded;
  const domain = input.domain.trim().toLowerCase();
  if (!FULL_DOMAIN_RE.test(domain)) return fail(400, "Domínio inválido.");

  const { parsed, expiresAt } = sslExpiry(new Date());
  const { data, error } = await supabaseAdmin
    .from("hosting_ssl_certificates")
    .insert({
      hosting_account_id: hostingId,
      domain,
      provider: input.provider?.trim() || "letsencrypt",
      status: "active",
      issued_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, "Já existe um certificado para esse domínio.");
    serverLogError("service:hosting-panel.installSsl", error);
    return fail(500, "Não foi possível instalar o certificado SSL.");
  }

  await supabaseAdmin
    .from("hosting_websites")
    .update({ ssl_status: "active", ssl_expires_at: expiresAt })
    .eq("hosting_account_id", hostingId)
    .eq("domain", domain);

  await panelAudit(AUDIT.HOSTING_SSL_INSTALLED, hostingId, ctx, { domain });
  await notifyEvent("hosting.ssl.installed", { domain, expiresAt: parsed.toLocaleDateString("pt-PT") }, { channels: ["dashboard"] });
  return { ok: true, certificate: sslShape(data) };
}

export async function renewSsl(ctx: AuthContext, hostingId: string, certificateId: string): Promise<ServiceResult<{ certificate: HostingSslCertificate }>> {
  const guarded = await guardPanel(ctx, hostingId, "ssl");
  if (!guarded.ok) return guarded;
  const { expiresAt } = sslExpiry(new Date());
  const { data, error } = await supabaseAdmin
    .from("hosting_ssl_certificates")
    .update({ status: "active", issued_at: new Date().toISOString(), expires_at: expiresAt })
    .eq("id", certificateId)
    .eq("hosting_account_id", hostingId)
    .select()
    .single();
  if (error || !data) return fail(404, "Certificado não encontrado.");
  await supabaseAdmin
    .from("hosting_websites")
    .update({ ssl_status: "active", ssl_expires_at: expiresAt })
    .eq("hosting_account_id", hostingId)
    .eq("domain", data.domain);
  await panelAudit(AUDIT.HOSTING_SSL_RENEWED, hostingId, ctx, { domain: data.domain });
  return { ok: true, certificate: sslShape(data) };
}

export async function removeSsl(ctx: AuthContext, hostingId: string, certificateId: string): Promise<ServiceResult<{ ok: true }>> {
  const guarded = await guardPanel(ctx, hostingId, "ssl");
  if (!guarded.ok) return guarded;
  const { data, error } = await supabaseAdmin
    .from("hosting_ssl_certificates")
    .delete()
    .eq("id", certificateId)
    .eq("hosting_account_id", hostingId)
    .select("domain")
    .single();
  if (error || !data) return fail(404, "Certificado não encontrado.");
  await supabaseAdmin
    .from("hosting_websites")
    .update({ ssl_status: "none", ssl_expires_at: null })
    .eq("hosting_account_id", hostingId)
    .eq("domain", data.domain);
  await panelAudit(AUDIT.HOSTING_SSL_REMOVED, hostingId, ctx, { domain: data.domain });
  return { ok: true };
}

/* --------------------------------------------------------------------- *
 * Cron jobs (capability-gated)
 * --------------------------------------------------------------------- */

function cronShape(row: Record<string, unknown>): HostingCronJob {
  return {
    id: String(row.id),
    hostingAccountId: String(row.hosting_account_id),
    command: String(row.command ?? ""),
    schedule: String(row.schedule ?? ""),
    status: String(row.status ?? "enabled"),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listCron(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ jobs: HostingCronJob[] }>> {
  const guarded = await guardPanel(ctx, hostingId, "cron");
  if (!guarded.ok) return guarded;
  const { data } = await supabaseAdmin
    .from("hosting_cron_jobs")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("created_at", { ascending: true });
  return { ok: true, jobs: (data ?? []).map(cronShape) };
}

export async function createCron(
  ctx: AuthContext,
  hostingId: string,
  input: { command: string; schedule: string },
): Promise<ServiceResult<{ job: HostingCronJob }>> {
  const guarded = await guardPanel(ctx, hostingId, "cron");
  if (!guarded.ok) return guarded;
  const command = input.command.trim();
  const schedule = input.schedule.trim();
  if (!command) return fail(400, "Indica o comando a executar.");
  if (!SCHEDULE_RE.test(schedule)) return fail(400, "Expressão cron inválida (5 campos).");
  const { data, error } = await supabaseAdmin
    .from("hosting_cron_jobs")
    .insert({ hosting_account_id: hostingId, command, schedule })
    .select()
    .single();
  if (error) {
    serverLogError("service:hosting-panel.createCron", error);
    return fail(500, "Não foi possível criar o cron job.");
  }
  await panelAudit(AUDIT.HOSTING_CRON_CREATED, hostingId, ctx, { command });
  return { ok: true, job: cronShape(data) };
}

export async function updateCron(
  ctx: AuthContext,
  hostingId: string,
  jobId: string,
  patch: { command?: string; schedule?: string; status?: string },
): Promise<ServiceResult<{ job: HostingCronJob }>> {
  const guarded = await guardPanel(ctx, hostingId, "cron");
  if (!guarded.ok) return guarded;
  const update: Record<string, unknown> = {};
  if (patch.command !== undefined) update.command = patch.command.trim();
  if (patch.schedule !== undefined) {
    if (!SCHEDULE_RE.test(patch.schedule.trim())) return fail(400, "Expressão cron inválida (5 campos).");
    update.schedule = patch.schedule.trim();
  }
  if (patch.status !== undefined) {
    if (!["enabled", "disabled"].includes(patch.status)) return fail(400, "Estado inválido.");
    update.status = patch.status;
  }
  if (!Object.keys(update).length) return fail(400, "Nada para atualizar.");
  const { data, error } = await supabaseAdmin
    .from("hosting_cron_jobs")
    .update(update)
    .eq("id", jobId)
    .eq("hosting_account_id", hostingId)
    .select()
    .single();
  if (error || !data) return fail(404, "Cron job não encontrado.");
  await panelAudit(AUDIT.HOSTING_CRON_UPDATED, hostingId, ctx, { jobId });
  return { ok: true, job: cronShape(data) };
}

export async function deleteCron(ctx: AuthContext, hostingId: string, jobId: string): Promise<ServiceResult<{ ok: true }>> {
  const guarded = await guardPanel(ctx, hostingId, "cron");
  if (!guarded.ok) return guarded;
  const { error } = await supabaseAdmin
    .from("hosting_cron_jobs")
    .delete()
    .eq("id", jobId)
    .eq("hosting_account_id", hostingId);
  if (error) return fail(404, "Cron job não encontrado.");
  await panelAudit(AUDIT.HOSTING_CRON_DELETED, hostingId, ctx, { jobId });
  return { ok: true };
}

/* --------------------------------------------------------------------- *
 * Security & performance (honestly computed from platform-managed state)
 * --------------------------------------------------------------------- */

export async function getSecurity(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ report: HostingSecurityReport }>> {
  const guarded = await guardPanel(ctx, hostingId, "security");
  if (!guarded.ok) return guarded;
  const [websites, ssl, backups, alerts] = await Promise.all([
    supabaseAdmin.from("hosting_websites").select("domain, ssl_status, php_version").eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_ssl_certificates").select("*").eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_backups").select("completed_at, status").eq("hosting_account_id", hostingId).eq("status", "completed"),
    supabaseAdmin.from("resource_alerts").select("level, status").eq("hosting_account_id", hostingId).eq("status", "open"),
  ]);

  let score = 100;
  const checks: SecurityCheck[] = [];

  const noSsl = (websites.data ?? []).filter((w) => w.ssl_status !== "active");
  if (noSsl.length === 0) {
    checks.push({ id: "ssl", label: "SSL ativo em todos os sites", ok: true });
  } else {
    score -= 10 + noSsl.length * 5;
    checks.push({ id: "ssl", label: "SSL ativo em todos os sites", ok: false, detail: `${noSsl.length} site(s) sem certificado ativo` });
  }

  const expiring = (ssl.data ?? []).filter((c) => {
    if (c.status !== "active" || !c.expires_at) return false;
    const days = (new Date(c.expires_at).getTime() - Date.now()) / 86400000;
    return days <= 14;
  });
  if (expiring.length === 0) {
    checks.push({ id: "ssl-expiry", label: "Certificados sem expiração próxima", ok: true });
  } else {
    score -= 15;
    checks.push({ id: "ssl-expiry", label: "Certificados sem expiração próxima", ok: false, detail: `${expiring.length} certificado(s) a expirar em ≤14 dias` });
  }

  const recentBackup = (backups.data ?? []).some((b) => b.completed_at && new Date(b.completed_at).getTime() > Date.now() - 7 * 86400000);
  if (recentBackup) {
    checks.push({ id: "backup", label: "Backup concluído nos últimos 7 dias", ok: true });
  } else {
    score -= 15;
    checks.push({ id: "backup", label: "Backup concluído nos últimos 7 dias", ok: false, detail: "Sem backup recente" });
  }

  const dangerAlerts = (alerts.data ?? []).filter((a) => a.level === "danger" || a.level === "warn").length;
  if (dangerAlerts === 0) {
    checks.push({ id: "alerts", label: "Sem alertas abertos", ok: true });
  } else {
    score -= 20;
    checks.push({ id: "alerts", label: "Sem alertas abertos", ok: false, detail: `${dangerAlerts} alerta(s) em aberto` });
  }

  return {
    ok: true,
    report: { score: Math.max(0, Math.min(100, score)), checks },
  };
}

export async function getPerformance(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ report: HostingPerformanceReport }>> {
  const guarded = await guardPanel(ctx, hostingId, "performance");
  if (!guarded.ok) return guarded;
  const plan = await loadPlan(guarded.account.plan_id);
  const [usage, websites, backups] = await Promise.all([
    latestUsage(hostingId),
    supabaseAdmin.from("hosting_websites").select("status").eq("hosting_account_id", hostingId),
    supabaseAdmin.from("hosting_backups").select("completed_at").eq("hosting_account_id", hostingId).eq("status", "completed"),
  ]);

  let score = 100;
  const metrics: PerformanceMetric[] = [];
  const recommendations: string[] = [];

  if (usage) {
    metrics.push({ label: "CPU atual", value: `${usage.cpuPercent}%`, tone: usage.cpuPercent >= 80 ? "danger" : usage.cpuPercent >= 60 ? "warn" : "ok" });
    metrics.push({ label: "Memória atual", value: `${usage.memoryPercent}%`, tone: usage.memoryPercent >= 80 ? "danger" : usage.memoryPercent >= 60 ? "warn" : "ok" });
    metrics.push({ label: "Armazenamento usado", value: `${usage.storageMb} MB`, tone: usage.storageMb >= (plan?.storageGb ?? 50) * 1024 * 0.9 ? "danger" : "ok" });
    if (usage.cpuPercent >= 80) { score -= 25; recommendations.push("Reduz o uso de CPU otimizando scripts ou subindo de plano."); }
    if (usage.memoryPercent >= 80) { score -= 25; recommendations.push("Reduz a memória utilizada ou dimensiona o plano."); }
  }

  const sitesInUse = (websites.data ?? []).length;
  const siteRatio = plan && plan.sites > 0 ? sitesInUse / plan.sites : 0;
  metrics.push({ label: "Sites em uso", value: `${sitesInUse}${plan ? ` / ${plan.sites}` : ""}`, tone: siteRatio >= 0.9 ? "warn" : "ok" });
  if (siteRatio >= 0.9) recommendations.push("Estás a usar a maioria dos sites do plano — considera um plano superior.");

  const latestBackup = (backups.data ?? [])[0]?.completed_at ?? null;
  metrics.push({ label: "Último backup", value: latestBackup ? new Date(latestBackup).toLocaleDateString("pt-PT") : "—", tone: "ok" });

  if (!recommendations.length) recommendations.push("Desempenho saudável. Continua a manter backups regulares.");

  return {
    ok: true,
    report: { score: Math.max(0, Math.min(100, score)), metrics, recommendations },
  };
}

/* --------------------------------------------------------------------- *
 * Alerts
 * --------------------------------------------------------------------- */

function alertShape(row: Record<string, unknown>): ResourceAlert {
  return {
    id: String(row.id),
    hostingAccountId: String(row.hosting_account_id),
    kind: String(row.kind ?? ""),
    level: String(row.level ?? "info"),
    message: String(row.message ?? ""),
    status: String(row.status ?? "open"),
    createdAt: String(row.created_at ?? ""),
    ackedAt: row.acked_at ? String(row.acked_at) : null,
  };
}

export async function listAlerts(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ alerts: ResourceAlert[] }>> {
  const guarded = await guardPanel(ctx, hostingId, "alerts");
  if (!guarded.ok) return guarded;
  const { data } = await supabaseAdmin
    .from("resource_alerts")
    .select("*")
    .eq("hosting_account_id", hostingId)
    .order("created_at", { ascending: false })
    .limit(50);
  return { ok: true, alerts: (data ?? []).map(alertShape) };
}

export async function ackAlert(ctx: AuthContext, hostingId: string, alertId: string): Promise<ServiceResult<{ ok: true }>> {
  const guarded = await guardPanel(ctx, hostingId, "alerts");
  if (!guarded.ok) return guarded;
  const { error } = await supabaseAdmin
    .from("resource_alerts")
    .update({ status: "acked", acked_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("hosting_account_id", hostingId);
  if (error) return fail(404, "Alerta não encontrado.");
  await panelAudit(AUDIT.HOSTING_ALERT_ACKED, hostingId, ctx, { alertId });
  return { ok: true };
}

/* --------------------------------------------------------------------- *
 * Activity
 * --------------------------------------------------------------------- */

export async function getActivity(ctx: AuthContext, hostingId: string): Promise<ServiceResult<{ activities: HostingActivityEntry[] }>> {
  const owned = await getOwnedAccount(ctx, hostingId);
  if (!owned.ok) return owned;
  const { data } = await supabaseAdmin
    .from("audit_logs")
    .select("action, actor_email, created_at")
    .eq("entity", "hosting_account")
    .eq("entity_id", hostingId)
    .order("created_at", { ascending: false })
    .limit(100);
  return { ok: true, activities: (data ?? []).map((a) => ({ action: a.action, actorEmail: a.actor_email ?? null, createdAt: a.created_at })) };
}

/* --------------------------------------------------------------------- *
 * Admin — accounts
 * --------------------------------------------------------------------- */

export type AdminHostingAccountRow = {
  id: string;
  domain: string | null;
  username: string | null;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  planName: string | null;
  planId: string | null;
  quotaGb: number;
  provider: string;
  renewsAt: string | null;
  createdAt: string;
  usage: HostingUsage | null;
  counts: { websites: number; databases: number; backups: number; alerts: number };
};

export async function adminListHostingAccounts(search?: string): Promise<ServiceResult<{ accounts: AdminHostingAccountRow[]; plans: { id: string; name: string }[] }>> {
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] } }));
  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email]));
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name");
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const { data: plans } = await supabaseAdmin.from("hosting_plans").select("id, name");
  const planNameById = new Map((plans ?? []).map((p) => [p.id, p.name]));

  const provider = providerInfo();

  const query = supabaseAdmin.from("hosting_accounts").select("*").order("created_at", { ascending: false }).limit(200);
  const { data: rows } = await query;
  const accounts: AdminHostingAccountRow[] = [];

  for (const row of rows ?? []) {
    const customerId = row.customer_id;
    const email = customerId ? emailById.get(customerId) ?? null : null;
    const name = customerId ? nameById.get(customerId) ?? null : null;
    const usage = await latestUsage(row.id);
    const counts = await listCounts(row.id);
    accounts.push({
      id: row.id,
      domain: row.domain ?? null,
      username: row.username ?? null,
      status: row.status ?? "pending",
      customerName: name,
      customerEmail: email,
      planName: row.plan_id ? planNameById.get(row.plan_id) ?? null : null,
      planId: row.plan_id ?? null,
      quotaGb: row.quota_gb ?? 0,
      provider: provider.id,
      renewsAt: row.renews_at ?? null,
      createdAt: row.created_at,
      usage,
      counts: { websites: counts.websites, databases: counts.databases, backups: counts.backups, alerts: counts.alerts },
    });
  }

  const filtered = search?.trim()
    ? accounts.filter(
        (a) =>
          (a.domain ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (a.customerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (a.customerEmail ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : accounts;

  return { ok: true, accounts: filtered, plans: (plans ?? []).map((p) => ({ id: p.id, name: p.name })) };
}

export async function adminGetAccount(hostingId: string): Promise<ServiceResult<{ account: HostingPanelAccount; plan: HostingPanelPlan | null; provider: ProviderInfo; usage: HostingUsage | null; counts: { websites: number; databases: number; backups: number; ssl: number; alerts: number; cron: number }; activity: HostingActivityEntry[] }>> {
  const { data: row } = await supabaseAdmin.from("hosting_accounts").select("*").eq("id", hostingId).maybeSingle();
  if (!row) return fail(404, "Conta de alojamento não encontrada.");
  const [plan, usage, counts, activity] = await Promise.all([
    loadPlan(row.plan_id),
    latestUsage(hostingId),
    listCounts(hostingId),
    (
      await supabaseAdmin
        .from("audit_logs")
        .select("action, actor_email, created_at")
        .eq("entity", "hosting_account")
        .eq("entity_id", hostingId)
        .order("created_at", { ascending: false })
        .limit(50)
    ).data as Array<{ action: string; actor_email: string | null; created_at: string }> ?? [],
  ]);
  return {
    ok: true,
    account: accountShape(row as AccountRow),
    plan,
    provider: providerInfo(),
    usage,
    counts,
    activity: activity.map((a) => ({ action: a.action, actorEmail: a.actor_email ?? null, createdAt: a.created_at })),
  };
}

export async function adminSetAccountStatus(
  hostingId: string,
  status: string,
  ctx: { userId?: string; email?: string; role: string },
  ip?: string,
  reason?: string,
): Promise<ServiceResult<{ account: unknown }>> {
  if (!["active", "suspended", "terminated", "cancelled"].includes(status)) return fail(400, "Estado inválido.");
  const { data: row } = await supabaseAdmin.from("hosting_accounts").select("*").eq("id", hostingId).maybeSingle();
  if (!row) return fail(404, "Conta de alojamento não encontrada.");

  const domain = String(row.domain ?? "");
  const providerSel = selectHostingProvider();
  if (status === "active" && row.status === "suspended") await providerSel.provider.unsuspend({ providerId: providerSel.provider.id, accountId: row.id, domain, reason });
  if (status === "suspended") await providerSel.provider.suspend({ providerId: providerSel.provider.id, accountId: row.id, domain, reason });
  if (status === "terminated") {
    await providerSel.provider.terminate({ providerId: providerSel.provider.id, accountId: row.id, domain, reason });
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "terminated") patch.terminated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("hosting_accounts").update(patch).eq("id", hostingId).select().single();
  if (error || !data) return fail(500, "Não foi possível atualizar a conta.");

  await logAudit({
    action: AUDIT.HOSTING_STATUS,
    entity: "hosting_account",
    entityId: hostingId,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip,
    meta: { status, reason: reason ?? undefined, domain },
  });
  await notifyEvent("hosting.status.changed", { domain, status, reason }, { channels: ["dashboard"] });
  return { ok: true, account: data };
}

export async function adminChangePlan(
  hostingId: string,
  planId: string,
  ctx: { userId?: string; email?: string; role: string },
  ip?: string,
): Promise<ServiceResult<{ ok: true }>> {
  const { data: plan } = await supabaseAdmin.from("hosting_plans").select("id, name").eq("id", planId).maybeSingle();
  if (!plan) return fail(400, "Plano inválido.");
  const { error } = await supabaseAdmin
    .from("hosting_accounts")
    .update({ plan_id: planId, updated_at: new Date().toISOString() })
    .eq("id", hostingId);
  if (error) return fail(500, "Não foi possível alterar o plano.");
  await logAudit({
    action: AUDIT.HOSTING_PLAN,
    entity: "hosting_account",
    entityId: hostingId,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip,
    meta: { planId, planName: plan.name },
  });
  return { ok: true };
}

export async function adminRefreshUsage(hostingId: string): Promise<ServiceResult<{ usage: HostingUsage }>> {
  const { data: row } = await supabaseAdmin.from("hosting_accounts").select("id").eq("id", hostingId).maybeSingle();
  if (!row) return fail(404, "Conta de alojamento não encontrada.");
  const snapshot = await computeUsageSnapshot(hostingId);
  const { data, error } = await supabaseAdmin
    .from("hosting_usage")
    .insert({ hosting_account_id: hostingId, ...snapshot })
    .select()
    .single();
  if (error || !data) {
    serverLogError("service:hosting-panel.adminRefreshUsage", error ?? new Error("no row"));
    return fail(500, "Não foi possível atualizar o uso.");
  }
  return {
    ok: true,
    usage: {
      id: data.id,
      measuredAt: data.measured_at,
      storageMb: Number(data.storage_mb ?? 0),
      bandwidthMb: Number(data.bandwidth_mb ?? 0),
      inodes: Number(data.inodes ?? 0),
      cpuPercent: Number(data.cpu_percent ?? 0),
      memoryPercent: Number(data.memory_percent ?? 0),
      sites: Number(data.sites ?? 0),
      databases: Number(data.databases ?? 0),
      emailAccounts: Number(data.email_accounts ?? 0),
    },
  };
}

export async function adminTriggerProvision(hostingId: string): Promise<ServiceResult<{ ok: true }>> {
  const { data: row } = await supabaseAdmin.from("hosting_accounts").select("order_id, status, id").eq("id", hostingId).maybeSingle();
  if (!row) return fail(404, "Conta de alojamento não encontrada.");
  if (row.status === "active") return fail(409, "A conta já está ativa.");
  if (!row.order_id) return fail(400, "Conta sem encomenda associada — não é possível reagendar a ativação.");
  const ok = await enqueueProvisioningJob(row.order_id, "hosting", hostingId);
  if (!ok) return fail(500, "Não foi possível agendar a ativação.");
  return { ok: true };
}

/* --------------------------------------------------------------------- *
 * Pure path helper (files safety — reserved for providers that support
 * real filesystems; rejects absolute paths and parent traversal).
 * --------------------------------------------------------------------- */

export function panelVirtualPath(raw: string | null | undefined): string | null {
  const path = (raw ?? "").replace(/\\/g, "/").trim();
  if (!path || path === "/") return "/";
  if (path.startsWith("/")) return null;
  const parts: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(segment)) return null;
    parts.push(segment);
  }
  return parts.length ? parts.join("/") : "/";
}