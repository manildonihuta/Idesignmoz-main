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
  doPropagationChecks,
  mapRecordRow,
  mapZoneRow,
  type RecordRow,
  type ZoneRow,
} from "@/lib/dns/mappers";
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  ProviderValidationError,
} from "@/lib/providers/errors";

const CF_BASE = "https://api.cloudflare.com/client/v4";
const CF_TIMEOUT_MS = 15_000;
const CF_MAX_PER_PAGE = 5000;

type CfResponse<T> = {
  success: boolean;
  result: T;
  errors: Array<{ code: number; message: string }>;
};

type CfZone = {
  id: string;
  name: string;
  status: string;
  name_servers: string[];
};

type CfRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority?: number | null;
  data?: Record<string, unknown>;
};

type CfDnssec = {
  status: string;
};

const CF_SUPPORTED_RECORD_TYPES = new Set([
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "NS",
  "MX",
  "CAA",
]);

// ── public helpers ──────────────────────────────────────────────────

export function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN);
}

let singleton: CloudflareDnsProvider | null = null;

export function createCloudflareDnsProvider(): DNSProvider {
  singleton = singleton ?? new CloudflareDnsProvider();
  return singleton;
}

export function cloudflareVerifyToken(): Promise<boolean> {
  return cfFetch<CfDnssec>("/user/tokens/verify")
    .then(() => true)
    .catch(() => false);
}

export function cfZoneStatusToDns(status: string): DnsZone["status"] {
  switch (status) {
    case "active":
      return "active";
    case "pending":
    case "initializing":
    case "moved":
      return "pending";
    case "deactivated":
    case "deleted":
      return "error";
    default:
      return "pending";
  }
}

export function cfDnssecStatusToDns(status: string): DnsZone["dnssec"] {
  switch (status) {
    case "active":
      return "active";
    case "pending":
      return "pending";
    case "disabled":
      return "disabled";
    default:
      return "error";
  }
}

export function dnsNameToCfFqdn(fullDomain: string, name: string): string {
  const base = fullDomain.toLowerCase();
  const normalized = name.trim().toLowerCase();
  if (normalized === "@" || normalized === "" || normalized === base) return base;
  if (normalized.endsWith(`.${base}`)) return normalized;
  return `${normalized}.${base}`;
}

export function cfNameToRelative(fullDomain: string, fqdn: string): string {
  const base = fullDomain.toLowerCase();
  const name = fqdn.toLowerCase();
  if (name === base) return "@";
  if (name.endsWith(`.${base}`)) return name.slice(0, -(base.length + 1));
  return name;
}

export function cfRecordValueToString(record: CfRecord): string {
  if (record.data) {
    if (record.type === "CAA") {
      const flags = String(record.data.flags ?? "0");
      const tag = String(record.data.tag ?? "");
      const val = String(record.data.value ?? "");
      return `${flags} ${tag} "${val}"`;
    }
    if (record.type === "SRV") {
      const prio = String(record.data.priority ?? 0);
      const weight = String(record.data.weight ?? 0);
      const port = String(record.data.port ?? 0);
      const target = String(record.data.target ?? record.content ?? "");
      return `${prio} ${weight} ${port} ${target}`;
    }
    return String(record.data.content ?? record.content);
  }
  return record.content;
}

// ── API client ──────────────────────────────────────────────────────

function requiredToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token)
    throw new ProviderAuthenticationError(
      "Cloudflare não configurado: falta CLOUDFLARE_API_TOKEN.",
    );
  return token;
}

async function cfFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<CfResponse<T>> {
  const token = requiredToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let res: Response;
  try {
    res = await fetch(`${CF_BASE}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(CF_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ProviderUnavailableError(
      `Cloudflare inacessível (${err instanceof Error ? err.message : "rede"}).`,
    );
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = (await res.json()) as {
        errors?: Array<{ message?: string }>;
      };
      detail = body.errors?.[0]?.message;
    } catch {
      /* no JSON body */
    }
    throwCfError(res.status, detail);
  }

  const payload = (await res.json()) as CfResponse<T>;
  if (!payload.success || (payload.errors && payload.errors.length > 0)) {
    const msg = payload.errors?.[0]?.message ?? "Cloudflare devolveu erro.";
    throw new ProviderValidationError(msg);
  }
  return payload;
}

function throwCfError(status: number, message?: string): never {
  const detail = message ?? `HTTP ${status}`;
  if (status === 401 || status === 403)
    throw new ProviderAuthenticationError(
      `Cloudflare rejeitou o token (${detail}).`,
    );
  if (status === 429)
    throw new ProviderRateLimitError("Limite de pedidos da Cloudflare atingido.");
  if (status >= 500)
    throw new ProviderUnavailableError(`Cloudflare indisponível (${detail}).`);
  throw new ProviderValidationError(`Pedido Cloudflare inválido (${detail}).`);
}

// ── zone helpers ────────────────────────────────────────────────────

function cfNameserversToObject(ns: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  ns.slice(0, 4).forEach((n, i) => {
    out[`ns${i + 1}`] = n;
  });
  return out;
}

async function loadZoneRow(zoneId: string): Promise<ZoneRow | null> {
  const { data, error } = await supabaseAdmin
    .from("dns_zones")
    .select("*")
    .eq("id", zoneId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ZoneRow;
}

function requireCfZoneId(row: ZoneRow | null): string {
  if (row?.provider !== "cloudflare" || !row.provider_zone_id) {
    throw new ProviderValidationError("Zona não está ligada à Cloudflare.");
  }
  return row.provider_zone_id;
}

function assertSupportedType(type: string): void {
  if (!CF_SUPPORTED_RECORD_TYPES.has(type.toUpperCase())) {
    throw new ProviderValidationError(
      `A Cloudflare não aceita registos ${type.toUpperCase()} pela API de gestão; edite-os no painel da Cloudflare.`,
    );
  }
}

function recordToInput(zone: ZoneRow, cf: CfRecord): DnsRecordInput {
  return {
    type: cf.type.toUpperCase() as DnsRecordInput["type"],
    name: cfNameToRelative(zone.full_domain, cf.name),
    value: cfRecordValueToString(cf),
    ttl: typeof cf.ttl === "number" ? cf.ttl : 3600,
    priority: cf.priority ?? null,
  };
}

async function upsertMirror(zoneId: string, zone: ZoneRow, cf: CfRecord): Promise<DnsRecord> {
  const input = recordToInput(zone, cf);
  const { data, error } = await supabaseAdmin
    .from("dns_records")
    .upsert(
      {
        zone_id: zoneId,
        type: input.type,
        name: input.name,
        value: input.value,
        ttl: input.ttl,
        priority: input.priority,
        provider_record_id: cf.id,
      },
      { onConflict: "provider_record_id" },
    )
    .select("*")
    .single();
  if (error || !data) throw new Error("Não foi possível gravar o espelho local do registo.");
  return mapRecordRow(data as RecordRow);
}

// ── CloudflareDnsProvider ───────────────────────────────────────────

class CloudflareDnsProvider implements DNSProvider {
  readonly key = "cloudflare";
  readonly label = "Cloudflare DNS";

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
    if (existing && existing.provider === "cloudflare") return existing;

    const cfZones = await cfFetch<CfZone[]>(
      `/zones?name=${encodeURIComponent(normalized)}&per_page=50`,
    );
    let cfZone = cfZones.result.find((z) => z.name.toLowerCase() === normalized);
    if (!cfZone) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!accountId) {
        throw new ProviderValidationError(
          "Cloudflare requer CLOUDFLARE_ACCOUNT_ID para criar zonas DNS.",
        );
      }
      const created = await cfFetch<CfZone>("/zones", {
        method: "POST",
        body: {
          name: normalized,
          account: { id: accountId },
          type: "full",
        },
      });
      cfZone = created.result;
    }

    const { data, error } = await supabaseAdmin
      .from("dns_zones")
      .upsert(
        {
          full_domain: normalized,
          user_id: userId,
          provider: "cloudflare",
          provider_zone_id: cfZone.id,
          status: cfZoneStatusToDns(cfZone.status),
          nameservers: cfNameserversToObject(cfZone.name_servers),
          dnssec: "disabled",
        },
        { onConflict: "full_domain" },
      )
      .select("*")
      .single();
    if (error || !data) {
      throw new ProviderUnavailableError(
        "Não foi possível registar a zona Cloudflare.",
      );
    }
    return mapZoneRow(data as ZoneRow);
  }

  async deleteZone(zoneId: string): Promise<void> {
    const row = await loadZoneRow(zoneId);
    if (!row) return;
    if (row.provider === "cloudflare" && row.provider_zone_id) {
      await cfFetch(`/zones/${row.provider_zone_id}`, { method: "DELETE" });
    }
    await supabaseAdmin.from("dns_zones").delete().eq("id", zoneId);
  }

  async listRecords(zoneId: string): Promise<DnsRecord[]> {
    const row = await loadZoneRow(zoneId);
    if (!row) return [];
    const cfZoneId = requireCfZoneId(row);

    const data = await cfFetch<CfRecord[]>(
      `/zones/${cfZoneId}/dns_records?per_page=${CF_MAX_PER_PAGE}`,
    );
    const cfRecords = data.result ?? [];
    const providerIds = new Set<string>();
    const results: DnsRecord[] = [];

    for (const cf of cfRecords) {
      providerIds.add(cf.id);
      const mirror = await upsertMirror(zoneId, row, cf);
      results.push(mirror);
    }

    // Remove orphaned mirrors that are no longer present in Cloudflare.
    if (providerIds.size > 0) {
      await supabaseAdmin
        .from("dns_records")
        .delete()
        .eq("zone_id", zoneId)
        .not("provider_record_id", "in", [...providerIds]);
    }

    return results.sort((a, b) =>
      a.name.localeCompare(b.name) || a.type.localeCompare(b.type),
    );
  }

  async createRecord(zoneId: string, input: DnsRecordInput): Promise<DnsRecord> {
    const row = await loadZoneRow(zoneId);
    if (!row) throw new ProviderValidationError("Zona não encontrada.");
    const cfZoneId = requireCfZoneId(row);
    assertSupportedType(input.type);

    const body: Record<string, unknown> = {
      type: input.type,
      name: dnsNameToCfFqdn(row.full_domain, input.name),
      content: input.value,
      ttl: input.ttl,
    };
    if (input.type === "MX") body.priority = input.priority ?? 0;

    const data = await cfFetch<CfRecord>(
      `/zones/${cfZoneId}/dns_records`,
      { method: "POST", body },
    );

    const mirror = await supabaseAdmin
      .from("dns_records")
      .upsert(
        {
          zone_id: zoneId,
          type: data.result.type.toUpperCase(),
          name: cfNameToRelative(row.full_domain, data.result.name),
          value: cfRecordValueToString(data.result),
          ttl: typeof data.result.ttl === "number" ? data.result.ttl : input.ttl,
          priority: data.result.priority ?? input.priority ?? null,
          provider_record_id: data.result.id,
        },
        { onConflict: "provider_record_id" },
      )
      .select("*")
      .single();
    if (mirror.error || !mirror.data) {
      throw new Error("Não foi possível gravar o espelho local do registo.");
    }
    return mapRecordRow(mirror.data as RecordRow);
  }

  async updateRecord(recordId: string, input: DnsRecordInput): Promise<DnsRecord> {
    const { data: mirror, error: mirrorErr } = await supabaseAdmin
      .from("dns_records")
      .select("*")
      .eq("id", recordId)
      .maybeSingle();
    if (mirrorErr || !mirror)
      throw new ProviderValidationError("Registo DNS não encontrado.");

    const row = await loadZoneRow(String(mirror.zone_id));
    if (!row) throw new ProviderValidationError("Zona DNS não encontrada.");
    const cfZoneId = requireCfZoneId(row);
    assertSupportedType(input.type);

    const body: Record<string, unknown> = {
      type: input.type,
      name: dnsNameToCfFqdn(row.full_domain, input.name),
      content: input.value,
      ttl: input.ttl,
    };
    if (input.type === "MX") body.priority = input.priority ?? 0;

    const recordIdCf = mirror.provider_record_id ? String(mirror.provider_record_id) : null;
    if (recordIdCf) {
      await cfFetch<CfRecord>(`/zones/${cfZoneId}/dns_records/${recordIdCf}`, {
        method: "PUT",
        body,
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
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
    if (updateErr || !updated)
      throw new Error("Não foi possível atualizar o registo DNS.");
    return mapRecordRow(updated as RecordRow);
  }

  async deleteRecord(recordId: string): Promise<void> {
    const { data: mirror, error: mirrorErr } = await supabaseAdmin
      .from("dns_records")
      .select("zone_id, provider_record_id")
      .eq("id", recordId)
      .maybeSingle();
    if (mirrorErr || !mirror) return;

    if (mirror.provider_record_id) {
      const row = await loadZoneRow(String(mirror.zone_id));
      if (row?.provider === "cloudflare" && row.provider_zone_id) {
        await cfFetch(
          `/zones/${row.provider_zone_id}/dns_records/${mirror.provider_record_id}`,
          { method: "DELETE" },
        );
      }
    }

    await supabaseAdmin.from("dns_records").delete().eq("id", recordId);
  }

  async getNameservers(zoneId: string): Promise<Record<string, string>> {
    const row = await loadZoneRow(zoneId);
    if (!row) return {};
    return { ...(row.nameservers ?? {}) };
  }

  async updateNameservers(
    zoneId: string,
    nameservers: DnsNameserversInput,
  ): Promise<void> {
    void zoneId;
    void nameservers;
    throw new ProviderValidationError(
      "Os nameservers da zona são atribuídos pela Cloudflare no ato de criação; altere-os no registrador de domínios.",
    );
  }

  async setDnssec(
    zoneId: string,
    enabled: boolean,
  ): Promise<{ dnssec: DnsZone["dnssec"] }> {
    const row = await loadZoneRow(zoneId);
    const cfZoneId = requireCfZoneId(row);
    const data = await cfFetch<CfDnssec>(`/zones/${cfZoneId}/dnssec`, {
      method: "PATCH",
      body: { status: enabled ? "active" : "disabled" },
    });
    return { dnssec: cfDnssecStatusToDns(data.result.status) };
  }

  async checkPropagation(
    zone: DnsZone,
    records: DnsRecord[],
  ): Promise<PropagationCheck[]> {
    return doPropagationChecks(zone, records);
  }

  async syncZone(zoneId: string): Promise<{ status: DnsZone["status"] }> {
    const row = await loadZoneRow(zoneId);
    if (!row) throw new ProviderValidationError("Zona não encontrada.");
    const cfZoneId = requireCfZoneId(row);

    const [zoneData, recordsData] = await Promise.all([
      cfFetch<CfZone>(`/zones/${cfZoneId}`),
      cfFetch<CfRecord[]>(
        `/zones/${cfZoneId}/dns_records?per_page=${CF_MAX_PER_PAGE}`,
      ),
    ]);

    const cfZone = zoneData.result;
    const cfRecords = recordsData.result ?? [];

    await supabaseAdmin
      .from("dns_zones")
      .update({
        status: cfZoneStatusToDns(cfZone.status),
        nameservers: cfNameserversToObject(cfZone.name_servers),
      })
      .eq("id", zoneId);

    const providerIds = new Set<string>();
    for (const cf of cfRecords) {
      providerIds.add(cf.id);
      await upsertMirror(zoneId, row, cf);
    }

    // Remove orphaned mirrors — Cloudflare is the source of truth for CF zones.
    if (providerIds.size > 0) {
      await supabaseAdmin
        .from("dns_records")
        .delete()
        .eq("zone_id", zoneId)
        .not("provider_record_id", "in", [...providerIds]);
    } else {
      // All CF records deleted.
      await supabaseAdmin
        .from("dns_records")
        .delete()
        .eq("zone_id", zoneId);
    }

    return { status: cfZoneStatusToDns(cfZone.status) };
  }
}