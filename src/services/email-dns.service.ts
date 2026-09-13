import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { logEmailActivity } from "@/lib/provisioning/email/activity";
import { queryDoH } from "@/lib/dns/mappers";
import { buildEmailDnsRecords } from "@/lib/email/dns-records";
import { ownedService, type EmailServiceRow } from "@/services/email.service";
import { fail, type ServiceResult } from "./result";
import type { AuthContext } from "@/lib/client";

export const EMAIL_DNS_STATUS_LABELS: Record<string, string> = {
  none: "Sem registos",
  pending: "Pendente",
  verifying: "A verificar",
  verified: "Verificado",
  failed: "Incompleto",
  external: "Externo",
};

export type DnsLookupFn = (name: string, type: string) => Promise<string[]>;

const defaultResolver: DnsLookupFn = (name, type) => queryDoH(name, type);

type EmailDnsRow = {
  id: string;
  email_service_id: string;
  record_type: string;
  status: string;
  value: Record<string, unknown> | null;
  selector: string | null;
  last_checked_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  meta: Record<string, unknown> | null;
};

export type EmailDnsValue = {
  type: string;
  name: string;
  value: string;
  priority: number | null;
};

export type EmailDnsRecordView = {
  id: string;
  recordType: string;
  status: string;
  value: EmailDnsValue | null;
  selector: string | null;
  lastCheckedAt: string | null;
};

export type EmailDnsBundle = {
  service: { id: string; domain: string; dnsStatus: string };
  records: EmailDnsRecordView[];
};

type LookupTarget = {
  name: string;
  type: string;
  match: (answers: string[]) => boolean;
};

function lookupTarget(domain: string, recordType: string, selector: string | null): LookupTarget {
  const d = domain.toLowerCase();
  switch (recordType) {
    case "mx":
      return { name: d, type: "MX", match: (answers) => answers.length > 0 };
    case "spf":
      return { name: d, type: "TXT", match: (answers) => answers.some((s) => s.toLowerCase().includes("v=spf1")) };
    case "dkim":
      return {
        name: `${selector || "default"}._domainkey.${d}`,
        type: "TXT",
        match: (answers) => answers.some((s) => s.toLowerCase().includes("v=dkim1")),
      };
    case "dmarc":
      return {
        name: `_dmarc.${d}`,
        type: "TXT",
        match: (answers) => answers.some((s) => s.toLowerCase().includes("v=dmarc1")),
      };
    default:
      return { name: d, type: "TXT", match: () => false };
  }
}

function toValue(v: Record<string, unknown> | null): EmailDnsValue | null {
  if (!v) return null;
  return {
    type: String(v.type ?? "TXT"),
    name: String(v.name ?? ""),
    value: String(v.value ?? ""),
    priority: v.priority == null ? null : Number(v.priority),
  };
}

function toRecordView(row: EmailDnsRow): EmailDnsRecordView {
  return {
    id: String(row.id),
    recordType: String(row.record_type),
    status: String(row.status ?? "pending"),
    value: toValue(row.value),
    selector: row.selector ?? null,
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
  };
}

async function readRows(serviceId: string): Promise<EmailDnsRow[]> {
  const { data, error } = await supabaseAdmin
    .from("email_dns_configs")
    .select("*")
    .eq("email_service_id", serviceId);
  if (error) {
    serverLogError("service:email.dns.read", error);
    return [];
  }
  return (data ?? []).map((row) => row as unknown as EmailDnsRow);
}

/**
 * Seeds (or refreshes) the four recommended records for a service. Values are
 * regenerated from the current build config, so upgrades to MX/SPF hosts are
 * picked up automatically without resetting verification state.
 */
async function ensureDnsRows(service: EmailServiceRow): Promise<EmailDnsRow[]> {
  const existing = await readRows(service.id);
  const byType = new Map<string, EmailDnsRow>();
  for (const row of existing) byType.set(String(row.record_type), row);

  for (const spec of buildEmailDnsRecords(service.domain)) {
    const row = byType.get(spec.recordType);
    if (!row) {
      const { error } = await supabaseAdmin.from("email_dns_configs").insert({
        email_service_id: service.id,
        record_type: spec.recordType,
        status: "pending",
        value: spec.value,
        selector: spec.selector,
        meta: { recommended: true },
      });
      if (error) serverLogError("service:email.dns.seed", error);
      continue;
    }
    const valueChanged =
      JSON.stringify(row.value ?? null) !== JSON.stringify(spec.value) ||
      (row.selector ?? null) !== spec.selector;
    if (valueChanged) {
      const { error } = await supabaseAdmin
        .from("email_dns_configs")
        .update({ value: spec.value, selector: spec.selector })
        .eq("email_service_id", service.id)
        .eq("record_type", spec.recordType);
      if (error) serverLogError("service:email.dns.refresh", error);
    }
  }

  return readRows(service.id);
}

function overallStatus(rows: EmailDnsRow[]): string {
  if (!rows.length) return "pending";
  const statuses = rows.map((r) => r.status);
  const verified = statuses.filter((s) => s === "verified").length;
  if (verified === statuses.length) return "verified";
  return verified > 0 ? "verifying" : "failed";
}

export async function getEmailDnsConfigs(
  ctx: AuthContext,
  serviceId: string,
): Promise<ServiceResult<EmailDnsBundle>> {
  let service: EmailServiceRow;
  try {
    service = await ownedService(ctx, serviceId);
  } catch (e) {
    return asFailure(e);
  }

  const rows = await ensureDnsRows(service);
  return {
    ok: true,
    service: { id: service.id, domain: service.domain, dnsStatus: service.dns_status ?? "pending" },
    records: rows.map(toRecordView),
  };
}

export async function verifyEmailDns(
  ctx: AuthContext,
  serviceId: string,
  resolver: DnsLookupFn = defaultResolver,
): Promise<ServiceResult<EmailDnsBundle>> {
  let service: EmailServiceRow;
  try {
    service = await ownedService(ctx, serviceId);
  } catch (e) {
    return asFailure(e);
  }

  const rows = await ensureDnsRows(service);
  const now = new Date().toISOString();

  for (const row of rows) {
    const target = lookupTarget(service.domain, row.record_type, row.selector);
    const answers = await resolver(target.name, target.type);
    const matched = target.match(answers);
    const { error } = await supabaseAdmin
      .from("email_dns_configs")
      .update({
        status: matched ? "verified" : "failed",
        last_checked_at: now,
        meta: { matched, answers, checkedAt: now },
      })
      .eq("id", String(row.id));
    if (error) serverLogError("service:email.dns.verify.update", error);
  }

  const refreshed = await readRows(service.id);
  const nextStatus = overallStatus(refreshed);
  const { error: svcErr } = await supabaseAdmin
    .from("email_services")
    .update({ dns_status: nextStatus, updated_at: now })
    .eq("id", service.id);
  if (svcErr) serverLogError("service:email.dns.service.status", svcErr);

  const configured = refreshed.filter((r) => r.status === "verified").length;
  await logEmailActivity({
    serviceId: service.id,
    actor: ctx.userId,
    action: "dns.verified",
    details: { configured, total: refreshed.length, dnsStatus: nextStatus },
  });

  if (nextStatus === "verified") {
    await logAudit({
      action: AUDIT.EMAIL_DNS_VERIFIED,
      entity: "email_service",
      entityId: service.id,
      actorId: ctx.userId,
      actorEmail: ctx.email,
      meta: { domain: service.domain, configured, total: refreshed.length },
    });
  }

  return {
    ok: true,
    service: { id: service.id, domain: service.domain, dnsStatus: nextStatus },
    records: refreshed.map(toRecordView),
  };
}

type Throwable = { status?: number; error?: string };
function asFailure(e: unknown): { ok: false; error: string; status: number } {
  if (e && typeof e === "object" && "status" in e) {
    const t = e as Throwable;
    return fail(t.status ?? 500, t.error ?? "Erro.");
  }
  return fail(500, "Erro inesperado.");
}