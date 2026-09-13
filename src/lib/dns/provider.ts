import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  DnsNameserversInput,
  DnsRecord,
  DnsRecordInput,
  DnsZone,
  DNSProvider,
  PropagationCheck,
} from "@/lib/dns/types";
import {
  DEFAULT_NAMESERVERS,
  doPropagationChecks,
  mapRecordRow,
  mapZoneRow,
  type RecordRow,
  type ZoneRow,
} from "@/lib/dns/mappers";
import { cloudflareConfigured, createCloudflareDnsProvider } from "@/lib/dns/providers/cloudflare";

export { DEFAULT_NAMESERVERS, mapZoneRow, mapRecordRow, recordFqName } from "./mappers";
export type { ZoneRow, RecordRow } from "./mappers";
export type { DNSProvider } from "./types";

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
    return doPropagationChecks(zone, records);
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

/**
 * Resolves the DNS backend for a zone (or the platform default when none is
 * given). Cloudflare-backed zones always use the Cloudflare adapter; new
 * zones default to Cloudflare once CLOUDFLARE_API_TOKEN is configured. Without
 * a Cloudflare token every zone uses the internal registry and reports an
 * honest pending state.
 */
export function getDnsProvider(zone?: Pick<DnsZone, "provider"> | null): DNSProvider {
  if (zone && zone.provider === "cloudflare") {
    return createCloudflareDnsProvider();
  }
  if (cloudflareConfigured()) {
    return createCloudflareDnsProvider();
  }
  localProvider = localProvider ?? new LocalDnsProvider();
  return localProvider;
}