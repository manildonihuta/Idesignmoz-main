import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { selectEmailProvider } from "@/lib/provisioning/email/registry";
import { logEmailActivity } from "@/lib/provisioning/email/activity";
import { fail, type ServiceResult } from "./result";

export type AdminActor = { userId?: string; email?: string; role?: string };

export type AdminEmailServiceView = {
  id: string;
  domain: string;
  planName: string | null;
  status: string;
  dnsStatus: string;
  mailboxLimit: number;
  storageLimitGb: number;
  expiresAt: string | null;
  createdAt: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  providerId: string | null;
  providerMode: string | null;
  used: { storageUsedGb: number; mailboxesUsed: number };
};

export type AdminEmailServiceDetail = {
  service: AdminEmailServiceView;
  mailboxes: Array<{
    id: string;
    emailAddress: string;
    displayName: string | null;
    status: string;
    storageLimitGb: number;
    storageUsedGb: number;
    quotaPercent: number;
    accessedAt: string | null;
    passwordChangedAt: string | null;
    createdAt: string | null;
    forwardTo: string[];
    providerMailboxId: string | null;
  }>;
  aliases: Array<{ id: string; aliasAddress: string; destination: string; status: string; createdAt: string | null }>;
  usageHistory: Array<{
    storageUsedGb: number;
    storageLimitGb: number;
    mailboxesUsed: number;
    mailboxesLimit: number;
    recordedAt: string | null;
  }>;
  activity: Array<{ action: string; actorEmail: string | null; createdAt: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServiceRow = {
  id: string;
  customer_id: string | null;
  domain: string;
  plan_name: string | null;
  status: string;
  dns_status: string;
  mailbox_limit: number | null;
  storage_limit_gb: number | null;
  expires_at: string | null;
  created_at: string | null;
  provider_email_id: string | null;
  meta: Record<string, unknown> | null;
};

export async function adminListEmailServices(
  search?: string,
): Promise<ServiceResult<{ services: AdminEmailServiceView[] }>> {
  const { data: raw, error } = await supabaseAdmin
    .from("email_services")
    .select("id, customer_id, domain, plan_name, status, dns_status, mailbox_limit, storage_limit_gb, expires_at, created_at, meta")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    serverLogError("service:email-admin.list", error);
    return fail(500, "Não foi possível listar os serviços de email.");
  }

  const services = (raw ?? []) as unknown as ServiceRow[];
  const ids = services.map((s) => s.id);

  const [{ data: mailboxes }, profilesRes, authUsers] = await Promise.all([
    ids.length
      ? supabaseAdmin
          .from("email_mailboxes")
          .select("email_service_id, status, storage_used_gb")
          .in("email_service_id", ids)
      : Promise.resolve({ data: [] as Array<{ email_service_id: string; status: string; storage_used_gb: number }> }),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", services.map((s) => s.customer_id).filter((v): v is string => Boolean(v))),
    supabaseAdmin.auth.admin.listUsers().then(({ data }) => data).catch(() => ({ users: [] })),
  ]);

  const usedByService = new Map<string, { storageUsedGb: number; active: number; total: number }>();
  for (const m of (mailboxes ?? []) as Array<{ email_service_id: string; status: string; storage_used_gb: number }>) {
    const cur = usedByService.get(m.email_service_id) ?? { storageUsedGb: 0, active: 0, total: 0 };
    if (m.status !== "deleted") {
      cur.total += 1;
      cur.storageUsedGb += Number(m.storage_used_gb ?? 0);
      if (m.status === "active") cur.active += 1;
    }
    usedByService.set(m.email_service_id, cur);
  }

  const nameByUserId = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
  const emailByUserId: Record<string, string> = {};
  authUsers?.users?.forEach((u) => u.email && (emailByUserId[u.id] = u.email));

  const q = search?.trim().toLowerCase();
  let rows = services.map((s) => {
    const customerId = s.customer_id ?? null;
    const used = usedByService.get(s.id) ?? { storageUsedGb: 0, active: 0, total: 0 };
    return {
      id: s.id,
      domain: s.domain,
      planName: s.plan_name ?? null,
      status: s.status,
      dnsStatus: s.dns_status,
      mailboxLimit: Number(s.mailbox_limit ?? 0),
      storageLimitGb: Number(s.storage_limit_gb ?? 0),
      expiresAt: s.expires_at ?? null,
      createdAt: s.created_at ?? null,
      customerId,
      customerName: customerId ? String(nameByUserId.get(customerId) ?? "") || null : null,
      customerEmail: customerId ? emailByUserId[customerId] ?? null : null,
      providerId: stringMeta(s.meta, "provider"),
      providerMode: stringMeta(s.meta, "providerMode"),
      used: {
        storageUsedGb: Math.round(100 * used.storageUsedGb) / 100,
        mailboxesUsed: used.active,
      },
    };
  });

  if (q) {
    rows = rows.filter(
      (r) =>
        r.domain.toLowerCase().includes(q) ||
        (r.customerName ?? "").toLowerCase().includes(q) ||
        (r.customerEmail ?? "").toLowerCase().includes(q),
    );
  }

  return { ok: true, services: rows };
}

export async function adminGetEmailService(
  serviceId: string,
): Promise<ServiceResult<{ detail: AdminEmailServiceDetail }>> {
  if (!UUID_RE.test(serviceId)) return fail(400, "Identificador inválido.");

  const { data: service, error } = await supabaseAdmin
    .from("email_services")
    .select("id, customer_id, domain, plan_name, status, dns_status, mailbox_limit, storage_limit_gb, expires_at, created_at, meta")
    .eq("id", serviceId)
    .maybeSingle();
  if (error || !service) {
    serverLogError("service:email-admin.detail", error ?? new Error("missing"));
    return fail(404, "Serviço de email não encontrado.");
  }
  const s = service as unknown as ServiceRow;

  const [mailboxesRes, aliasesRes, historyRes, activityRes] = await Promise.all([
    supabaseAdmin
      .from("email_mailboxes")
      .select("id, email_address, display_name, status, storage_limit_gb, storage_used_gb, quota_percent, accessed_at, created_at, forward_to, meta, provider_mailbox_id")
      .eq("email_service_id", s.id)
      .not("status", "eq", "deleted")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("email_aliases")
      .select("id, alias_address, destination, status, created_at")
      .eq("email_service_id", s.id)
      .not("status", "eq", "deleted")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("email_usage")
      .select("storage_used_gb, storage_limit_gb, mailboxes_used, mailboxes_limit, recorded_at")
      .eq("email_service_id", s.id)
      .order("recorded_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("email_activity_logs")
      .select("action, actor, created_at")
      .eq("email_service_id", s.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const { data: authList } = await supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] } }));
  const emailByUserId: Record<string, string> = {};
  (authList?.users ?? []).forEach((u) => u.email && (emailByUserId[u.id] = u.email));

  const customerId = s.customer_id ?? null;
  let customerName: string | null = null;
  if (customerId) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", customerId)
      .maybeSingle();
    customerName = profile?.full_name ? String(profile.full_name) : null;
  }

  const usageHistory = ((historyRes.data ?? []).slice().reverse() as Record<string, unknown>[]).map((u) => ({
    storageUsedGb: Number(u.storage_used_gb ?? 0),
    storageLimitGb: Number(u.storage_limit_gb ?? 0),
    mailboxesUsed: Number(u.mailboxes_used ?? 0),
    mailboxesLimit: Number(u.mailboxes_limit ?? 0),
    recordedAt: u.recorded_at ? String(u.recorded_at) : null,
  }));

  return {
    ok: true,
    detail: {
      service: {
        id: s.id,
        domain: s.domain,
        planName: s.plan_name ?? null,
        status: s.status,
        dnsStatus: s.dns_status,
        mailboxLimit: Number(s.mailbox_limit ?? 0),
        storageLimitGb: Number(s.storage_limit_gb ?? 0),
        expiresAt: s.expires_at ?? null,
        createdAt: s.created_at ?? null,
        customerId,
        customerName,
        customerEmail: customerId ? emailByUserId[customerId] ?? null : null,
        providerId: stringMeta(s.meta, "provider"),
        providerMode: stringMeta(s.meta, "providerMode"),
        used: {
          storageUsedGb: usageHistory.length ? (usageHistory[usageHistory.length - 1] as { storageUsedGb: number }).storageUsedGb : 0,
          mailboxesUsed: usageHistory.length ? (usageHistory[usageHistory.length - 1] as { mailboxesUsed: number }).mailboxesUsed : 0,
        },
      },
      mailboxes: (mailboxesRes.data ?? []).map((m) => ({
        id: String(m.id),
        emailAddress: String(m.email_address ?? ""),
        displayName: m.display_name ? String(m.display_name) : null,
        status: String(m.status ?? ""),
        storageLimitGb: Number(m.storage_limit_gb ?? 0),
        storageUsedGb: Number(m.storage_used_gb ?? 0),
        quotaPercent: Number(m.quota_percent ?? 0),
        accessedAt: m.accessed_at ? String(m.accessed_at) : null,
        passwordChangedAt: stringMeta((m.meta ?? {}) as Record<string, unknown>, "passwordChangedAt"),
        createdAt: m.created_at ? String(m.created_at) : null,
        forwardTo: Array.isArray(m.forward_to) ? (m.forward_to as unknown[]).map((v) => String(v)) : [],
        providerMailboxId: m.provider_mailbox_id ? String(m.provider_mailbox_id) : null,
      })),
      aliases: (aliasesRes.data ?? []).map((a) => ({
        id: String(a.id),
        aliasAddress: String(a.alias_address ?? ""),
        destination: String(a.destination ?? ""),
        status: String(a.status ?? ""),
        createdAt: a.created_at ? String(a.created_at) : null,
      })),
      usageHistory,
      activity: (activityRes.data ?? []).map((a) => ({
        action: String(a.action ?? ""),
        actorEmail: a.actor ? emailByUserId[String(a.actor)] ?? null : null,
        createdAt: a.created_at ? String(a.created_at) : new Date().toISOString(),
      })),
    },
  };
}

export async function adminSyncEmailUsage(
  serviceId: string,
  actor: AdminActor,
  ip?: string,
): Promise<ServiceResult<{ usage: { storageUsedGb: number; mailboxesUsed: number; recordedAt: string } }>> {
  if (!UUID_RE.test(serviceId)) return fail(400, "Identificador inválido.");

  const { data: service, error } = await supabaseAdmin
    .from("email_services")
    .select("id, customer_id, domain, status, mailbox_limit, storage_limit_gb, provider_email_id, meta")
    .eq("id", serviceId)
    .maybeSingle();
  if (error || !service) {
    serverLogError("service:email-admin.sync", error ?? new Error("missing"));
    return fail(404, "Serviço de email não encontrado.");
  }
  if (service.status !== "active") {
    return fail(409, "O serviço de email ainda não está ativo.");
  }

  const { data: mailboxes, error: mbErr } = await supabaseAdmin
    .from("email_mailboxes")
    .select("id, email_address, status, storage_limit_gb, provider_mailbox_id")
    .eq("email_service_id", service.id)
    .not("status", "eq", "deleted");
  if (mbErr) {
    serverLogError("service:email-admin.sync.mailboxes", mbErr);
    return fail(500, "Não foi possível ler as caixas do serviço.");
  }

  const active = mailboxes.filter((m) => m.status === "active");
  const selection = selectEmailProvider();
  let result;
  try {
    result = await selection.provider.refreshMailboxUsage({
      domain: String(service.domain ?? ""),
      serviceProviderEmailId: String(service.provider_email_id ?? ""),
      providerMeta: (service.meta ?? {}) as Record<string, unknown>,
      mailboxes: active.map((m) => ({
        emailAddress: String(m.email_address),
        providerMailboxId: m.provider_mailbox_id ? String(m.provider_mailbox_id) : null,
      })),
    });
  } catch (e) {
    serverLogError("service:email-admin.sync.provider", e);
    return fail(503, e instanceof Error ? e.message : "Não foi possível ler o uso do fornecedor.");
  }
  if (!result.ok) {
    return fail(503, result.message ?? "Não foi possível sincronizar o uso do fornecedor.");
  }

  const all = mailboxes as Array<{ id: string; email_address: string; status: string; storage_limit_gb: number | null }>;
  const usedById = new Map<string, number>();
  for (const entry of result.mailboxes) {
    const row = all.find((m) => m.email_address.toLowerCase() === entry.emailAddress.toLowerCase());
    if (!row) continue;
    const limitGb = Number(row.storage_limit_gb) || 0;
    let usedGb = Math.max(0, Number(entry.storageUsedGb) || 0);
    if (limitGb > 0) usedGb = Math.min(limitGb, usedGb);
    const percent = limitGb > 0 ? Math.min(100, Math.round((usedGb / limitGb) * 100)) : 0;
    usedById.set(row.id, usedGb);
    await supabaseAdmin
      .from("email_mailboxes")
      .update({ storage_used_gb: usedGb, quota_percent: percent, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  const storageUsedGb =
    Math.round(
      100 * all.filter((m) => m.status !== "deleted").reduce((sum, m) => sum + (usedById.get(m.id) ?? 0), 0),
    ) / 100;
  const recordedAt = new Date().toISOString();
  await supabaseAdmin.from("email_usage").insert({
    email_service_id: service.id,
    storage_used_gb: storageUsedGb,
    storage_limit_gb: Number(service.storage_limit_gb ?? 0),
    mailboxes_used: active.length,
    mailboxes_limit: Number(service.mailbox_limit ?? 0),
    recorded_at: recordedAt,
  });

  await logEmailActivity({
    serviceId: service.id,
    actor: actor.userId ?? "system",
    action: "admin.usage.synced",
    details: { storageUsedGb, mailboxesUsed: active.length, actorEmail: actor.email ?? null },
  });
  await logAudit({
    action: AUDIT.EMAIL_USAGE_SYNCED,
    entity: "email_service",
    entityId: service.id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { storageUsedGb, mailboxesUsed: active.length, admin: true },
  });

  return {
    ok: true,
    usage: { storageUsedGb, mailboxesUsed: active.length, recordedAt },
  };
}

export async function adminSetEmailServiceStatus(
  serviceId: string,
  status: "suspend" | "resume",
  actor: AdminActor,
  ip?: string,
  reason?: string,
): Promise<ServiceResult<{ service: { id: string; status: string } }>> {
  if (!UUID_RE.test(serviceId)) return fail(400, "Identificador inválido.");

  const { data: service, error } = await supabaseAdmin
    .from("email_services")
    .select("id, customer_id, domain, status, meta")
    .eq("id", serviceId)
    .maybeSingle();
  if (error || !service) {
    serverLogError("service:email-admin.status", error ?? new Error("missing"));
    return fail(404, "Serviço de email não encontrado.");
  }

  const next = status === "suspend" ? "suspended" : "active";
  if (service.status === next) {
    return fail(409, status === "suspend" ? "O serviço já está suspenso." : "O serviço já está ativo.");
  }

  const selection = selectEmailProvider();
  const action = { emailServiceId: service.id, domain: String(service.domain ?? ""), reason };
  let providerResult;
  try {
    providerResult =
      status === "suspend"
        ? await selection.provider.suspend(action)
        : await selection.provider.reactivate(action);
  } catch (e) {
    serverLogError("service:email-admin.status.provider", e);
    return fail(503, e instanceof Error ? e.message : "Falha na operação junto do fornecedor.");
  }
  if (!providerResult.ok) {
    return fail(503, providerResult.message ?? "Falha na operação junto do fornecedor.");
  }

  const { error: updErr } = await supabaseAdmin
    .from("email_services")
    .update({ status: next, provider_status: next, updated_at: new Date().toISOString() })
    .eq("id", service.id);
  if (updErr) {
    serverLogError("service:email-admin.status.update", updErr);
    return fail(500, "Estado aplicado no fornecedor, mas não foi possível guardar o registo.");
  }

  await logEmailActivity({
    serviceId: service.id,
    actor: actor.userId ?? "system",
    action: status === "suspend" ? "admin.suspended" : "admin.reactivated",
    details: { reason: reason ?? null, actorEmail: actor.email ?? null },
  });
  await logAudit({
    action: status === "suspend" ? AUDIT.EMAIL_SERVICE_SUSPENDED : AUDIT.EMAIL_SERVICE_REACTIVATED,
    entity: "email_service",
    entityId: service.id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { reason: reason ?? null },
  });

  return { ok: true, service: { id: service.id, status: next } };
}

function stringMeta(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v ? v : null;
}