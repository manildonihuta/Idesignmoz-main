import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { selectEmailProvider } from "@/lib/provisioning/email/registry";
import { logEmailActivity } from "@/lib/provisioning/email/activity";
import { fail, type ServiceResult } from "./result";
import type { AuthContext } from "@/lib/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/i;
const MIN_PASSWORD = 8;

export type EmailMailboxView = {
  id: string;
  emailAddress: string;
  displayName: string | null;
  status: string;
  storageLimitGb: number;
  storageUsedGb: number;
  quotaPercent: number;
  accessedAt: string | null;
  createdAt: string | null;
};

export type EmailServiceDetail = {
  id: string;
  domain: string;
  planName: string;
  status: string;
  dnsStatus: string;
  mailboxLimit: number;
  storageLimitGb: number;
  expiresAt: string | null;
  providerLabel: string | null;
  providerMode: string | null;
  mailboxes: EmailMailboxView[];
  usage: { storageUsedGb: number; mailboxesUsed: number };
};

type EmailServiceRow = {
  id: string;
  customer_id: string | null;
  domain: string;
  plan_name: string;
  status: string;
  dns_status: string;
  mailbox_limit: number;
  storage_limit_gb: number;
  expires_at: string | null;
  provider_email_id: string | null;
  provider_status: string | null;
  meta: Record<string, unknown> | null;
};

async function ownedService(ctx: AuthContext, serviceId: string): Promise<EmailServiceRow> {
  if (!ctx.userId) throw { status: 401, error: "Não autenticado." };
  if (!UUID_RE.test(serviceId)) throw { status: 400, error: "Identificador inválido." };

  const { data, error } = await supabaseAdmin
    .from("email_services")
    .select("id, customer_id, domain, plan_name, status, dns_status, mailbox_limit, storage_limit_gb, expires_at, provider_email_id, provider_status, meta")
    .eq("id", serviceId)
    .maybeSingle();

  if (error || !data) throw { status: 404, error: "Serviço de email não encontrado." };
  if (data.customer_id !== ctx.userId) throw { status: 403, error: "Serviço não pertence a esta conta." };
  return data as unknown as EmailServiceRow;
}

export async function getEmailServiceDetail(
  ctx: AuthContext,
  serviceId: string,
): Promise<ServiceResult<{ service: EmailServiceDetail }>> {
  let service: EmailServiceRow;
  try {
    service = await ownedService(ctx, serviceId);
  } catch (e) {
    return asFailure(e);
  }

  const [mailboxesRes, usageRes] = await Promise.all([
    supabaseAdmin
      .from("email_mailboxes")
      .select("id, email_address, display_name, status, storage_limit_gb, storage_used_gb, quota_percent, accessed_at, created_at")
      .eq("email_service_id", service.id)
      .not("status", "eq", "deleted")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("email_usage")
      .select("storage_used_gb, mailboxes_used")
      .eq("email_service_id", service.id)
      .order("recorded_at", { ascending: false })
      .limit(1),
  ]);

  const usageRow = (usageRes.data?.[0] ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    service: {
      id: service.id,
      domain: service.domain,
      planName: service.plan_name,
      status: service.status,
      dnsStatus: service.dns_status,
      mailboxLimit: service.mailbox_limit,
      storageLimitGb: Number(service.storage_limit_gb ?? 0),
      expiresAt: service.expires_at ?? null,
      providerLabel: stringMeta(service.meta, "providerLabel"),
      providerMode: stringMeta(service.meta, "providerMode"),
      mailboxes: (mailboxesRes.data ?? []).map((m) => ({
        id: m.id,
        emailAddress: m.email_address,
        displayName: m.display_name ?? null,
        status: m.status,
        storageLimitGb: Number(m.storage_limit_gb ?? 0),
        storageUsedGb: Number(m.storage_used_gb ?? 0),
        quotaPercent: Number(m.quota_percent ?? 0),
        accessedAt: m.accessed_at ?? null,
        createdAt: m.created_at ?? null,
      })),
      usage: {
        storageUsedGb: Number(usageRow.storage_used_gb ?? 0),
        mailboxesUsed: Number(usageRow.mailboxes_used ?? 0),
      },
    },
  };
}

export async function createMailbox(
  ctx: AuthContext,
  serviceId: string,
  input: { localPart?: unknown; displayName?: unknown; password?: unknown },
): Promise<ServiceResult<{ mailbox: EmailMailboxView }>> {
  let service: EmailServiceRow;
  try {
    service = await ownedService(ctx, serviceId);
  } catch (e) {
    return asFailure(e);
  }

  if (service.status !== "active") {
    return fail(409, "O serviço de email ainda não está ativo.");
  }

  const localPart = String(input.localPart ?? "").trim().toLowerCase();
  if (!LOCAL_PART_RE.test(localPart) || localPart.length > 64) {
    return fail(400, "Nome da caixa de email inválido (letras, números, ponto, hífen e _).");
  }
  const displayName = typeof input.displayName === "string" ? input.displayName.trim().slice(0, 80) : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < MIN_PASSWORD) {
    return fail(400, `A password deve ter pelo menos ${MIN_PASSWORD} caracteres.`);
  }

  const emailAddress = `${localPart}@${service.domain}`;

  const { data: existing } = await supabaseAdmin
    .from("email_mailboxes")
    .select("id")
    .eq("email_service_id", service.id)
    .eq("email_address", emailAddress)
    .not("status", "eq", "deleted")
    .maybeSingle();
  if (existing) {
    return fail(409, "Já existe uma caixa com este endereço.");
  }

  const { data: countRow } = await supabaseAdmin
    .from("email_mailboxes")
    .select("id, status", { count: "exact" })
    .eq("email_service_id", service.id)
    .not("status", "eq", "deleted");
  const active = (countRow ?? []).filter((m) => m.status === "active").length;
  if (active >= service.mailbox_limit) {
    return fail(409, `O plano permite no máximo ${service.mailbox_limit} caixas.`);
  }

  const quotaGb = Math.max(1, Math.round(Number(service.storage_limit_gb) || 1));
  const selection = selectEmailProvider();
  let result;
  try {
    result = await selection.provider.createMailbox({
      localPart,
      domain: service.domain,
      emailAddress,
      displayName: displayName || undefined,
      password,
      quotaGb,
    });
  } catch (e) {
    serverLogError("service:email.createMailbox", e);
    return fail(503, e instanceof Error ? e.message : "Não foi possível criar a caixa no fornecedor.");
  }
  if (!result.ok) {
    return fail(503, result.message ?? "Não foi possível criar a caixa no fornecedor.");
  }

  const { data: mailbox, error: insertErr } = await supabaseAdmin
    .from("email_mailboxes")
    .insert({
      email_service_id: service.id,
      provider_mailbox_id: result.providerMailboxId ?? null,
      email_address: emailAddress,
      display_name: displayName || null,
      status: "active",
      storage_limit_gb: quotaGb,
      storage_used_gb: 0,
      quota_percent: 0,
      meta: { provider: selection.provider.id, providerMode: selection.mode },
    })
    .select("id, email_address, display_name, status, storage_limit_gb, storage_used_gb, quota_percent, accessed_at, created_at")
    .single();
  if (insertErr) {
    serverLogError("service:email.mailbox.insert", insertErr);
    return fail(409, "Já existe uma caixa com este endereço ou o registo falhou.");
  }

  await refreshUsage(service.id);
  await logEmailActivity({
    serviceId: service.id,
    mailboxId: mailbox.id,
    actor: ctx.userId,
    action: "mailbox.created",
    details: { emailAddress, provider: selection.provider.id, mode: selection.mode },
  });
  await logAudit({
    action: AUDIT.EMAIL_MAILBOX_CREATED,
    entity: "email_mailbox",
    entityId: mailbox.id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    meta: { serviceId: service.id, emailAddress },
  });

  return { ok: true, mailbox: toMailboxView(mailbox) };
}

export async function mailboxAction(
  ctx: AuthContext,
  serviceId: string,
  mailboxId: string,
  action: "suspend" | "resume" | "delete",
): Promise<ServiceResult<{ mailbox: EmailMailboxView }>> {
  let service: EmailServiceRow;
  try {
    service = await ownedService(ctx, serviceId);
  } catch (e) {
    return asFailure(e);
  }
  if (!UUID_RE.test(mailboxId)) {
    return fail(400, "Identificador de caixa inválido.");
  }

  const { data: mailbox, error } = await supabaseAdmin
    .from("email_mailboxes")
    .select("id, email_address, display_name, status, storage_limit_gb, storage_used_gb, quota_percent, accessed_at, created_at, provider_mailbox_id")
    .eq("id", mailboxId)
    .eq("email_service_id", service.id)
    .maybeSingle();
  if (error || !mailbox) {
    return fail(404, "Caixa de email não encontrada.");
  }
  if (mailbox.status === "deleted") {
    return fail(409, "A caixa já foi removida.");
  }

  if (action !== "delete") {
    const nextStatus = action === "suspend" ? "suspended" : "active";
    if (mailbox.status === nextStatus) {
      return fail(409, `A caixa já está ${nextStatus === "suspended" ? "suspensa" : "ativa"}.`);
    }
  }

  const selection = selectEmailProvider();
  const ref = {
    emailAddress: mailbox.email_address,
    domain: service.domain,
    serviceProviderEmailId: String(service.provider_email_id ?? ""),
    providerMeta: (service.meta ?? {}) as Record<string, unknown>,
  };

  let providerResult;
  try {
    providerResult =
      action === "suspend"
        ? await selection.provider.suspendMailbox(ref)
        : action === "resume"
          ? await selection.provider.reactivateMailbox(ref)
          : await selection.provider.deleteMailbox(ref);
  } catch (e) {
    serverLogError("service:email.mailbox.action", e);
    return fail(503, e instanceof Error ? e.message : "Falha na operação junto do fornecedor.");
  }
  if (!providerResult.ok) {
    return fail(503, providerResult.message ?? "Falha na operação junto do fornecedor.");
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (action === "delete") {
    update.status = "deleted";
    update.storage_used_gb = 0;
  } else {
    update.status = action === "suspend" ? "suspended" : "active";
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("email_mailboxes")
    .update(update)
    .eq("id", mailbox.id)
    .select("id, email_address, display_name, status, storage_limit_gb, storage_used_gb, quota_percent, accessed_at, created_at")
    .single();
  if (updErr) {
    serverLogError("service:email.mailbox.update", updErr);
    return fail(500, "Não foi possível guardar o novo estado da caixa.");
  }

  if (action !== "delete") await refreshUsage(service.id);

  const ACTION_LOG = {
    suspend: { audit: AUDIT.EMAIL_MAILBOX_SUSPENDED, activity: "mailbox.suspended" },
    resume: { audit: AUDIT.EMAIL_MAILBOX_REACTIVATED, activity: "mailbox.reactivated" },
    delete: { audit: AUDIT.EMAIL_MAILBOX_DELETED, activity: "mailbox.deleted" },
  } as const;

  await logEmailActivity({
    serviceId: service.id,
    mailboxId: mailbox.id,
    actor: ctx.userId,
    action: ACTION_LOG[action].activity,
    details: { emailAddress: mailbox.email_address },
  });
  await logAudit({
    action: ACTION_LOG[action].audit,
    entity: "email_mailbox",
    entityId: mailbox.id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    meta: { serviceId: service.id, emailAddress: mailbox.email_address },
  });

  return { ok: true, mailbox: toMailboxView(updated) };
}

async function refreshUsage(serviceId: string): Promise<void> {
  const [mailboxesRes, latest] = await Promise.all([
    supabaseAdmin
      .from("email_mailboxes")
      .select("status")
      .eq("email_service_id", serviceId),
    supabaseAdmin
      .from("email_usage")
      .select("id, storage_limit_gb, mailboxes_limit, mailboxes_used")
      .eq("email_service_id", serviceId)
      .order("recorded_at", { ascending: false })
      .limit(1),
  ]);
  const last = (latest.data?.[0] ?? {}) as Record<string, unknown>;
  const rows = mailboxesRes.data ?? [];
  const active = rows.filter((m) => m.status === "active").length;
  const total = rows.filter((m) => m.status !== "deleted").length;

  if (last.id) {
    await supabaseAdmin
      .from("email_usage")
      .update({
        mailboxes_used: active,
        mailboxes_limit: Number(last.mailboxes_limit ?? active),
        recorded_at: new Date().toISOString(),
      })
      .eq("id", last.id);
  } else {
    await supabaseAdmin.from("email_usage").insert({
      email_service_id: serviceId,
      storage_used_gb: 0,
      storage_limit_gb: Number(last.storage_limit_gb ?? 0),
      mailboxes_used: active,
      mailboxes_limit: total,
    });
  }
}

function toMailboxView(m: Record<string, unknown>): EmailMailboxView {
  return {
    id: String(m.id),
    emailAddress: String(m.email_address ?? ""),
    displayName: m.display_name ? String(m.display_name) : null,
    status: String(m.status ?? ""),
    storageLimitGb: Number(m.storage_limit_gb ?? 0),
    storageUsedGb: Number(m.storage_used_gb ?? 0),
    quotaPercent: Number(m.quota_percent ?? 0),
    accessedAt: m.accessed_at ? String(m.accessed_at) : null,
    createdAt: m.created_at ? String(m.created_at) : null,
  };
}

function stringMeta(meta: Record<string, unknown> | null, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v ? v : null;
}

type Throwable = { status?: number; error?: string };
function asFailure(e: unknown): { ok: false; error: string; status: number } {
  if (e && typeof e === "object" && "status" in e) {
    const t = e as Throwable;
    return fail(t.status ?? 500, t.error ?? "Erro.");
  }
  return fail(500, "Erro inesperado.");
}