import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceFailure, type ServiceResult } from "@/services/result";
import { getDnsProvider } from "@/lib/dns/provider";
import type {
  DnsActivity,
  DnsBundle,
  DnsRecord,
  PropagationCheck,
} from "@/lib/dns/types";
import { mapZoneRow, type ZoneRow } from "@/lib/dns/provider";
import { getDnsTemplate } from "@/lib/dns/templates";
import {
  parseDnsRecordInput,
  parseNameserversInput,
  resolveTtl,
} from "@/lib/dns/validation";

type Actor = {
  userId?: string;
  email?: string;
};

const PROVIDER = getDnsProvider(null);

async function findZoneRow(fullDomain: string): Promise<ZoneRow | null> {
  const { data, error } = await supabaseAdmin
    .from("dns_zones")
    .select("*")
    .eq("full_domain", fullDomain.toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as ZoneRow;
}

async function isDomainOwned(ctx: Actor, fullDomain: string): Promise<boolean> {
  const domain = fullDomain.toLowerCase();
  if (!ctx.userId && !ctx.email) return false;
  if (ctx.userId) {
    const { count: domainCount } = await supabaseAdmin
      .from("domains")
      .select("*", { count: "exact", head: true })
      .eq("full_domain", domain)
      .eq("customer_id", ctx.userId);
    if (domainCount) return true;
    const { count: orderCount } = await supabaseAdmin
      .from("domain_orders")
      .select("*", { count: "exact", head: true })
      .eq("full_domain", domain)
      .eq("customer_id", ctx.userId);
    if (orderCount) return true;
  }
  if (ctx.email) {
    const { count: emailCount } = await supabaseAdmin
      .from("domain_orders")
      .select("*", { count: "exact", head: true })
      .eq("full_domain", domain)
      .eq("email", ctx.email);
    if (emailCount) return true;
  }
  return false;
}

async function hasAccess(zone: ZoneRow | null, ctx: Actor, admin = false): Promise<boolean> {
  if (admin) return true;
  if (!zone) return false;
  if (ctx.userId && zone.user_id === ctx.userId) return true;
  return isDomainOwned(ctx, zone.full_domain);
}

async function logActivity(input: {
  zoneId: string;
  user: Actor;
  action: string;
  recordType?: string | null;
  recordId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  await supabaseAdmin.from("dns_activity_logs").insert({
    zone_id: input.zoneId,
    user_id: input.user.userId ?? null,
    action: input.action,
    record_type: input.recordType ?? null,
    record_id: input.recordId ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    meta: input.meta ?? null,
  });
}

function mapActivityRow(row: Record<string, unknown>): DnsActivity {
  return {
    id: String(row.id),
    zoneId: String(row.zone_id),
    userId: row.user_id ? String(row.user_id) : null,
    action: String(row.action),
    recordType: row.record_type ? String(row.record_type) : null,
    recordId: row.record_id ? String(row.record_id) : null,
    oldValue: row.old_value ? String(row.old_value) : null,
    newValue: row.new_value ? String(row.new_value) : null,
    meta: row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : null,
    createdAt: String(row.created_at),
  };
}

async function readActivities(zoneId: string, limit = 60): Promise<DnsActivity[]> {
  const { data, error } = await supabaseAdmin
    .from("dns_activity_logs")
    .select("*")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => mapActivityRow(row as Record<string, unknown>));
}

async function readBundle(zone: ZoneRow, activitiesLimit = 60): Promise<DnsBundle> {
  const provider = getDnsProvider(zone);
  const records = await provider.listRecords(zone.id);
  const activities = await readActivities(zone.id, activitiesLimit);
  return { zone: mapZoneRow(zone), records, activities };
}

async function ensureZone(domain: string, user: Actor): Promise<{ zone: ZoneRow; created: boolean }> {
  const existing = await findZoneRow(domain);
  if (existing) return { zone: existing, created: false };
  const zone = await PROVIDER.ensureZone(domain.toLowerCase(), user.userId ?? null);
  const row = await findZoneRow(zone.fullDomain);
  if (!row) throw new Error("Não foi possível criar a zona DNS.");
  return { zone: row, created: true };
}

function noAccess(): ServiceFailure {
  return fail(403, "Não tem permissão para aceder a este domínio.");
}

/** Server-side ownership check used by layouts before rendering a domain page. */
export async function userOwnsDomain(ctx: AuthContext, fullDomain: string): Promise<boolean> {
  if (!ctx.authenticated) return false;
  return isDomainOwned(ctx, fullDomain);
}

function notFound(message = "Domínio não encontrado."): ServiceFailure {
  return fail(404, message);
}

// ----------------------------------------------------------------------
// CLIENT operations — ownership always verified server-side.
// ----------------------------------------------------------------------

export async function dnsGetBundle(ctx: AuthContext, fullDomain: string): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const found = await findZoneRow(fullDomain);
  if (!found) {
    // First visit creates the zone row (truthful "pending" state).
    return dnsEnsureZone(ctx, fullDomain);
  }
  if (!(await hasAccess(found, ctx))) return noAccess();
  return { ok: true, bundle: await readBundle(found) };
}

export async function dnsEnsureZone(ctx: AuthContext, fullDomain: string): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  if (!(await isDomainOwned(ctx, fullDomain))) return noAccess();
  const { zone } = await ensureZone(fullDomain, ctx);
  if (!zone) return notFound();
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: "zone_created",
    meta: { provider: "local" },
  });
  const bundle = await readBundle(zone);
  return { ok: true, bundle };
}

export async function dnsCreateRecord(
  ctx: AuthContext,
  fullDomain: string,
  raw: unknown,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  const parsed = parseDnsRecordInput(raw);
  if (!parsed.ok) return fail(400, parsed.message);
  const provider = getDnsProvider(zone);
  const created = await provider.createRecord(zone.id, parsed.data);
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: "record_created",
    recordType: created.type,
    recordId: created.id,
    newValue: `${created.name} ${created.type} ${created.value}`,
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function dnsUpdateRecord(
  ctx: AuthContext,
  fullDomain: string,
  recordId: string,
  raw: unknown,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  const parsed = parseDnsRecordInput(raw);
  if (!parsed.ok) return fail(400, parsed.message);
  const { data: existing } = await supabaseAdmin
    .from("dns_records")
    .select("type, name, value")
    .eq("id", recordId)
    .maybeSingle();
  if (!existing) return notFound("Registo DNS não encontrado.");
  const provider = getDnsProvider(zone);
  const updated = await provider.updateRecord(recordId, parsed.data);
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: "record_updated",
    recordType: updated.type,
    recordId: updated.id,
    oldValue: `${existing.name} ${existing.type} ${existing.value}`,
    newValue: `${updated.name} ${updated.type} ${updated.value}`,
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function dnsDeleteRecord(
  ctx: AuthContext,
  fullDomain: string,
  recordId: string,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  const { data: existing } = await supabaseAdmin
    .from("dns_records")
    .select("type, name, value")
    .eq("id", recordId)
    .maybeSingle();
  if (!existing) return notFound("Registo DNS não encontrado.");
  const provider = getDnsProvider(zone);
  await provider.deleteRecord(recordId);
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: "record_deleted",
    recordType: String(existing.type),
    recordId: recordId,
    oldValue: `${existing.name} ${existing.type} ${existing.value}`,
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function dnsUpdateNameservers(
  ctx: AuthContext,
  fullDomain: string,
  raw: unknown,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  const parsed = parseNameserversInput(raw);
  if (!parsed.ok) return fail(400, parsed.message);
  const provider = getDnsProvider(zone);
  await provider.updateNameservers(zone.id, parsed.data);
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: "nameservers_updated",
    newValue: Object.values(parsed.data).join(", "),
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function dnsSetDnssec(
  ctx: AuthContext,
  fullDomain: string,
  enabled: boolean,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  const provider = getDnsProvider(zone);
  const result = await provider.setDnssec(zone.id, enabled);
  const { error } = await supabaseAdmin
    .from("dns_zones")
    .update({ dnssec: result.dnssec })
    .eq("id", zone.id);
  if (error) return fail(500, "Não foi possível atualizar o estado DNSSEC.");
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: enabled ? "dnssec_enabled" : "dnssec_disabled",
    newValue: result.dnssec,
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function dnsCheckPropagation(
  ctx: AuthContext,
  fullDomain: string,
): Promise<ServiceResult<{ bundle: DnsBundle; checks: PropagationCheck[] }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  const provider = getDnsProvider(zone);
  const records = await provider.listRecords(zone.id);
  const checks = await provider.checkPropagation(mapZoneRow(zone), records);
  const matched = checks.filter((c) => c.matched).length;
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: "propagation_checked",
    meta: { total: checks.length, matched },
  });
  return { ok: true, bundle: await readBundle(zone), checks };
}

export async function dnsApplyTemplate(
  ctx: AuthContext,
  fullDomain: string,
  templateId: string,
): Promise<ServiceResult<{ bundle: DnsBundle; added: number; skipped: number }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  const template = getDnsTemplate(templateId);
  if (!template) return fail(400, "Modelo DNS desconhecido.");
  const provider = getDnsProvider(zone);
  const existing = await provider.listRecords(zone.id);
  const seen = new Set(existing.map((r) => `${r.type}|${r.name.toLowerCase()}|${r.value}`));

  let added = 0;
  let skipped = 0;
  for (const record of template.records) {
    const parsed = parseDnsRecordInput({
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: resolveTtl(3600),
      priority: record.priority ?? null,
    });
    if (!parsed.ok) {
      skipped += 1;
      continue;
    }
    const key = `${parsed.data.type}|${parsed.data.name.toLowerCase()}|${parsed.data.value}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    await provider.createRecord(zone.id, parsed.data);
    seen.add(key);
    added += 1;
  }
  await logActivity({
    zoneId: zone.id,
    user: ctx,
    action: "template_applied",
    meta: { template: templateId, added, skipped },
  });
  return { ok: true, bundle: await readBundle(zone), added, skipped };
}

export async function dnsListActivity(
  ctx: AuthContext,
  fullDomain: string,
): Promise<ServiceResult<{ activities: DnsActivity[] }>> {
  const zone = await findZoneRow(fullDomain);
  if (!zone) return notFound();
  if (!(await hasAccess(zone, ctx))) return noAccess();
  return { ok: true, activities: await readActivities(zone.id, 200) };
}

// ----------------------------------------------------------------------
// ADMIN operations — permission is enforced at the route layer.
// ----------------------------------------------------------------------

export async function adminDnsListZones(): Promise<
  ServiceResult<{
    zones: Array<{ zone: DnsBundle["zone"]; records: DnsRecord[]; lastActivity: DnsActivity | null }>;
  }>
> {
  const { data: zones, error } = await supabaseAdmin
    .from("dns_zones")
    .select("*")
    .order("full_domain", { ascending: true });
  if (error || !zones) return fail(500, "Não foi possível listar as zonas DNS.");

  const zoneIds = zones.map((z) => (z as ZoneRow).id);
  const [recordsResult, activityResult] = await Promise.all([
    zoneIds.length
      ? supabaseAdmin.from("dns_records").select("*").in("zone_id", zoneIds)
      : Promise.resolve({ data: [], error: null }),
    zoneIds.length
      ? supabaseAdmin.from("dns_activity_logs").select("*").in("zone_id", zoneIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const recordsByZone = new Map<string, DnsRecord[]>();
  for (const row of recordsResult.data ?? []) {
    const typed = row as Record<string, unknown>;
    const zoneId = String(typed.zone_id);
    const arr = recordsByZone.get(zoneId) ?? [];
    arr.push(mapRecordFromRow(typed));
    recordsByZone.set(zoneId, arr);
  }
  const lastByZone = new Map<string, DnsActivity>();
  for (const row of activityResult.data ?? []) {
    const activity = mapActivityRow(row as Record<string, unknown>);
    if (!lastByZone.has(activity.zoneId)) lastByZone.set(activity.zoneId, activity);
  }

  const zonesWithData = zones.map((raw) => {
    const zone = mapZoneRow(raw as ZoneRow);
    return {
      zone,
      records: recordsByZone.get(zone.id) ?? [],
      lastActivity: lastByZone.get(zone.id) ?? null,
    };
  });
  return { ok: true, zones: zonesWithData };
}

function mapRecordFromRow(row: Record<string, unknown>): DnsRecord {
  return {
    id: String(row.id),
    zoneId: String(row.zone_id),
    type: String(row.type) as DnsRecord["type"],
    name: String(row.name),
    value: String(row.value),
    ttl: Number(row.ttl),
    priority: row.priority == null ? null : Number(row.priority),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function adminDnsGetBundle(zoneId: string): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const { data, error } = await supabaseAdmin.from("dns_zones").select("*").eq("id", zoneId).maybeSingle();
  if (error || !data) return notFound("Zona DNS não encontrada.");
  const zone = data as ZoneRow;
  return { ok: true, bundle: await readBundle(zone) };
}

export async function adminDnsCreateZone(fullDomain: string, requesting: Actor): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const { zone } = await ensureZone(fullDomain, requesting);
  if (!zone) return notFound();
  await logActivity({
    zoneId: zone.id,
    user: requesting,
    action: "zone_created",
    meta: { provider: "local", source: "admin" },
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function adminDnsDeleteZone(zoneId: string): Promise<ServiceResult<{ ok: true }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  await getDnsProvider(zone).deleteZone(zoneId);
  return { ok: true };
}

export async function adminDnsSyncZone(zoneId: string, requesting: Actor): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  const result = await getDnsProvider(zone).syncZone(zoneId);
  await logActivity({
    zoneId,
    user: requesting,
    action: "zone_synced",
    newValue: result.status,
    meta: { source: "admin" },
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function adminDnsCheckPropagation(zoneId: string, requesting: Actor): Promise<ServiceResult<{ checks: PropagationCheck[] }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  const provider = getDnsProvider(zone);
  const records = await provider.listRecords(zoneId);
  const checks = await provider.checkPropagation(mapZoneRow(zone), records);
  const matched = checks.filter((c) => c.matched).length;
  await logActivity({
    zoneId,
    user: requesting,
    action: "propagation_checked",
    meta: { total: checks.length, matched, source: "admin" },
  });
  return { ok: true, checks };
}

export async function adminDnsUpsertRecord(
  mode: "create" | "update",
  zoneId: string,
  recordId: string | undefined,
  raw: unknown,
  requesting: Actor,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  const parsed = parseDnsRecordInput(raw);
  if (!parsed.ok) return fail(400, parsed.message);
  const provider = getDnsProvider(zone);
  if (mode === "create") {
    const created = await provider.createRecord(zoneId, parsed.data);
    await logActivity({
      zoneId,
      user: requesting,
      action: "record_created",
      recordType: created.type,
      recordId: created.id,
      newValue: `${created.name} ${created.type} ${created.value}`,
      meta: { source: "admin" },
    });
  } else {
    if (!recordId) return fail(400, "Falta o id do registo.");
    const { data: existing } = await supabaseAdmin
      .from("dns_records")
      .select("type, name, value")
      .eq("id", recordId)
      .eq("zone_id", zoneId)
      .maybeSingle();
    if (!existing) return notFound("Registo DNS não encontrado.");
    const updated = await provider.updateRecord(recordId, parsed.data);
    await logActivity({
      zoneId,
      user: requesting,
      action: "record_updated",
      recordType: updated.type,
      recordId: updated.id,
      oldValue: `${existing.name} ${existing.type} ${existing.value}`,
      newValue: `${updated.name} ${updated.type} ${updated.value}`,
      meta: { source: "admin" },
    });
  }
  return { ok: true, bundle: await readBundle(zone) };
}

export async function adminDnsDeleteRecord(
  zoneId: string,
  recordId: string,
  requesting: Actor,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  const { data: existing } = await supabaseAdmin
    .from("dns_records")
    .select("type, name, value")
    .eq("id", recordId)
    .eq("zone_id", zoneId)
    .maybeSingle();
  if (!existing) return notFound("Registo DNS não encontrado.");
  await getDnsProvider(zone).deleteRecord(recordId);
  await logActivity({
    zoneId,
    user: requesting,
    action: "record_deleted",
    recordType: String(existing.type),
    recordId,
    oldValue: `${existing.name} ${existing.type} ${existing.value}`,
    meta: { source: "admin" },
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function adminDnsUpdateNameservers(
  zoneId: string,
  raw: unknown,
  requesting: Actor,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  const parsed = parseNameserversInput(raw);
  if (!parsed.ok) return fail(400, parsed.message);
  await getDnsProvider(zone).updateNameservers(zoneId, parsed.data);
  await logActivity({
    zoneId,
    user: requesting,
    action: "nameservers_updated",
    newValue: Object.values(parsed.data).join(", "),
    meta: { source: "admin" },
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function adminDnsSetDnssec(
  zoneId: string,
  enabled: boolean,
  requesting: Actor,
): Promise<ServiceResult<{ bundle: DnsBundle }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  const result = await getDnsProvider(zone).setDnssec(zoneId, enabled);
  const { error } = await supabaseAdmin
    .from("dns_zones")
    .update({ dnssec: result.dnssec })
    .eq("id", zoneId);
  if (error) return fail(500, "Não foi possível atualizar o estado DNSSEC.");
  await logActivity({
    zoneId,
    user: requesting,
    action: enabled ? "dnssec_enabled" : "dnssec_disabled",
    newValue: result.dnssec,
    meta: { source: "admin" },
  });
  return { ok: true, bundle: await readBundle(zone) };
}

export async function adminDnsListActivity(zoneId: string): Promise<ServiceResult<{ activities: DnsActivity[] }>> {
  const zone = await findZoneById(zoneId);
  if (!zone) return notFound("Zona DNS não encontrada.");
  return { ok: true, activities: await readActivities(zoneId, 300) };
}

async function findZoneById(zoneId: string): Promise<ZoneRow | null> {
  const { data, error } = await supabaseAdmin.from("dns_zones").select("*").eq("id", zoneId).maybeSingle();
  if (error || !data) return null;
  return data as ZoneRow;
}