import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  DnsRecord,
  DnsRecordInput,
  DnsNameserversInput,
  DnsZone,
  PropagationCheck,
} from "@/lib/dns/types";

const DEFAULT_NAMESERVERS: Record<string, string> = {
  ns1: "ns1.idesignmoz.com",
  ns2: "ns2.idesignmoz.com",
};

export type ZoneRow = {
  id: string;
  full_domain: string;
  user_id: string | null;
  provider: string;
  provider_zone_id: string | null;
  status: string;
  nameservers: Record<string, string> | null;
  dnssec: string;
  created_at: string;
  updated_at: string;
};

type RecordRow = {
  id: string;
  zone_id: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority: number | null;
  created_at: string;
  updated_at: string;
};

export function mapZoneRow(row: ZoneRow): DnsZone {
  return {
    id: row.id,
    fullDomain: row.full_domain,
    userId: row.user_id,
    provider: row.provider,
    providerZoneId: row.provider_zone_id,
    status: row.status as DnsZone["status"],
    nameservers: { ...DEFAULT_NAMESERVERS, ...(row.nameservers ?? {}) },
    dnssec: row.dnssec as DnsZone["dnssec"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRecordRow(row: RecordRow): DnsRecord {
  return {
    id: row.id,
    zoneId: row.zone_id,
    type: row.type as DnsRecord["type"],
    name: row.name,
    value: row.value,
    ttl: row.ttl,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeComparison(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.$/, "")
    .replace(/^"(.*)"$/, "$1");
}

async function queryDoH(name: string, type: string): Promise<string[]> {
  try {
    const url = new URL("https://dns.google/resolve");
    url.searchParams.set("name", name);
    url.searchParams.set("type", type);
    url.searchParams.set("t", String(Date.now()));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/dns-json" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: Array<{ type?: number; data?: string | string[] }> };
    if (!Array.isArray(json.Answer)) return [];
    const answers: string[] = [];
    for (const answer of json.Answer) {
      if (answer === null || typeof answer !== "object") continue;
      const data = answer.data;
      if (typeof data === "string") answers.push(data);
      else if (Array.isArray(data)) answers.push(...data.filter((d): d is string => typeof d === "string"));
    }
    return answers;
  } catch {
    return [];
  }
}

function fqName(fullDomain: string, name: string): string {
  if (name === "@" || name === "*") return fullDomain;
  if (name.toLowerCase().endsWith(`.${fullDomain.toLowerCase()}`)) return name;
  return `${name}.${fullDomain}`;
}

export function recordFqName(zone: Pick<DnsZone, "fullDomain">, record: Pick<DnsRecord, "name">): string {
  return fqName(zone.fullDomain, record.name);
}

/**
 * DNSProvider — abstraction over a real DNS backend.
 *
 * The platform ships with a `local` provider that stores records in the
 * IDesign Moz database and reports truthful "pending / manual setup /
 * provider not connected" states — it never fakes an active provider.
 *
 * Future providers (Cloudflare, registrar API, cPanel/WHM, Plesk) implement
 * the same interface and are selected by `getDnsProvider()` based on env
 * configuration, so nothing upstream has to change.
 */
export interface DNSProvider {
  readonly key: string;
  readonly label: string;
  getZone(fullDomain: string): Promise<DnsZone | null>;
  ensureZone(fullDomain: string, userId: string | null): Promise<DnsZone>;
  deleteZone(zoneId: string): Promise<void>;
  listRecords(zoneId: string): Promise<DnsRecord[]>;
  createRecord(zoneId: string, input: DnsRecordInput): Promise<DnsRecord>;
  updateRecord(recordId: string, input: DnsRecordInput): Promise<DnsRecord>;
  deleteRecord(recordId: string): Promise<void>;
  getNameservers(zoneId: string): Promise<Record<string, string>>;
  updateNameservers(zoneId: string, nameservers: DnsNameserversInput): Promise<void>;
  setDnssec(zoneId: string, enabled: boolean): Promise<{ dnssec: DnsZone["dnssec"] }>;
  checkPropagation(zone: DnsZone, records: DnsRecord[]): Promise<PropagationCheck[]>;
  syncZone(zoneId: string): Promise<{ status: DnsZone["status"] }>;
}

/**
 * Local provider — records live in the platform database. No registrar/zone
 * service is connected yet, so the zone reports "pending configuration" and
 * DNSSEC is never simulated as active.
 */
class LocalDnsProvider implements DNSProvider {
  readonly key = "local";
  readonly label = "Registo interno (configuração manual)";

  async getZone(fullDomain: string): Promise<DnsZone | null> {
    const { data, error } = await supabaseAdmin
      .from("dns_zones")
      .select("*")
      .eq("full_domain", fullDomain.toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return mapZoneRow(data as ZoneRow);
  }

  async ensureZone(fullDomain: string, userId: string | null): Promise<DnsZone> {
    const normalized = fullDomain.toLowerCase();
    const existing = await this.getZone(normalized);
    if (existing) return existing;

    const { data, error } = await supabaseAdmin
      .from("dns_zones")
      .insert({
        full_domain: normalized,
        user_id: userId,
        provider: "local",
        status: "pending",
        nameservers: DEFAULT_NAMESERVERS,
        dnssec: "disabled",
      })
      .select("*")
      .single();

    if (error || !data) {
      // Concurrent create may have won the race — read it back.
      const winner = await this.getZone(normalized);
      if (winner) return winner;
      throw new Error("Não foi possível criar a zona DNS.");
    }
    return mapZoneRow(data as ZoneRow);
  }

  async deleteZone(zoneId: string): Promise<void> {
    await supabaseAdmin.from("dns_zones").delete().eq("id", zoneId);
  }

  async listRecords(zoneId: string): Promise<DnsRecord[]> {
    const { data, error } = await supabaseAdmin
      .from("dns_records")
      .select("*")
      .eq("zone_id", zoneId)
      .order("name", { ascending: true })
      .order("type", { ascending: true });
    if (error || !data) return [];
    return data.map((row) => mapRecordRow(row as RecordRow));
  }

  async createRecord(zoneId: string, input: DnsRecordInput): Promise<DnsRecord> {
    const { data, error } = await supabaseAdmin
      .from("dns_records")
      .insert({
        zone_id: zoneId,
        type: input.type,
        name: input.name,
        value: input.value,
        ttl: input.ttl,
        priority: input.priority,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error("Não foi possível criar o registo DNS.");
    return mapRecordRow(data as RecordRow);
  }

  async updateRecord(recordId: string, input: DnsRecordInput): Promise<DnsRecord> {
    const { data, error } = await supabaseAdmin
      .from("dns_records")
      .update({
        type: input.type,
        name: input.name,
        value: input.value,
        ttl: input.ttl,
        priority: input.priority,
      })
      .eq("id", recordId)
      .select("*")
      .single();
    if (error || !data) throw new Error("Não foi possível atualizar o registo DNS.");
    return mapRecordRow(data as RecordRow);
  }

  async deleteRecord(recordId: string): Promise<void> {
    const { error } = await supabaseAdmin.from("dns_records").delete().eq("id", recordId);
    if (error) throw new Error("Não foi possível remover o registo DNS.");
  }

  async getNameservers(zoneId: string): Promise<Record<string, string>> {
    const { data, error } = await supabaseAdmin
      .from("dns_zones")
      .select("nameservers")
      .eq("id", zoneId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_NAMESERVERS };
    return { ...DEFAULT_NAMESERVERS, ...((data.nameservers as Record<string, string>) ?? {}) };
  }

  async updateNameservers(zoneId: string, nameservers: DnsNameserversInput): Promise<void> {
    const merged: Record<string, string> = {};
    for (const [key, value] of Object.entries(nameservers)) {
      if (value && ["ns1", "ns2", "ns3", "ns4"].includes(key)) merged[key] = value;
    }
    const { error } = await supabaseAdmin
      .from("dns_zones")
      .update({ nameservers: merged, status: "pending" })
      .eq("id", zoneId);
    if (error) throw new Error("Não foi possível guardar os nameservers.");
  }

  /**
   * Without a connected registrar/provider, DNSSEC cannot be published at the
   * zone level. Enable/disable only records the intent in a truthful state —
   * it never pretends the zone is secured.
   */
  async setDnssec(_zoneId: string, enabled: boolean): Promise<{ dnssec: DnsZone["dnssec"] }> {
    return { dnssec: enabled ? "pending" : "disabled" };
  }

  async checkPropagation(zone: DnsZone, records: DnsRecord[]): Promise<PropagationCheck[]> {
    const seen = new Map<string, { name: string; type: string; query: string; expected: string[] }>();
    for (const record of records) {
      const query = fqName(zone.fullDomain, record.name);
      const key = `${query}|${record.type}`;
      const entry = seen.get(key) ?? { name: record.name, type: record.type, query, expected: [] };
      entry.expected.push(record.value);
      seen.set(key, entry);
    }

    const checks: PropagationCheck[] = [];
    const checkedAt = new Date().toISOString();
    for (const entry of seen.values()) {
      const answers = await queryDoH(entry.query, entry.type);
      const normalized = answers.map(normalizeComparison);
      const matched = entry.expected.some((expected) => {
        const target = normalizeComparison(expected);
        return normalized.some((answer) => answer === target || answer.includes(target));
      });
      checks.push({
        name: entry.name,
        type: entry.type,
        query: entry.query,
        answers,
        matched,
        checkedAt,
      });
    }
    return checks;
  }

  async syncZone(zoneId: string): Promise<{ status: DnsZone["status"] }> {
    // Local registry: nothing external to re-import. Keep the current state
    // but mark it as "pending" if it was errored so the UI can recover.
    const { data, error } = await supabaseAdmin
      .from("dns_zones")
      .select("status")
      .eq("id", zoneId)
      .maybeSingle();
    if (error || !data) throw new Error("Zona não encontrada.");
    const status = data.status === "error" ? "pending" : data.status;
    await supabaseAdmin.from("dns_zones").update({ status }).eq("id", zoneId);
    return { status: status as DnsZone["status"] };
  }
}

let localProvider: LocalDnsProvider | null = null;

export function getDnsProvider(zone?: Pick<DnsZone, "provider"> | null): DNSProvider {
  if (zone && zone.provider !== "local") {
    // External providers (Cloudflare, registrars, cPanel/WHM, Plesk) are wired
    // here once credentials are configured; until then every zone uses the
    // internal registry and reports an honest pending state.
  }
  localProvider = localProvider ?? new LocalDnsProvider();
  return localProvider;
}