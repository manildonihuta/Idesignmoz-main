import type {
  DnsRecord,
  DnsZone,
  PropagationCheck,
} from "./types";

export const DEFAULT_NAMESERVERS: Record<string, string> = {
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

export type RecordRow = {
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
 * Resolves every stored record against DNS-over-HTTPS and reports whether the
 * live answers match the expected values. Generic across DNS backends.
 */
export async function doPropagationChecks(zone: Pick<DnsZone, "fullDomain">, records: DnsRecord[]): Promise<PropagationCheck[]> {
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
    const normalizedAnswers = answers.map(normalizeComparison);
    const matched = entry.expected.some((expected) => {
      const target = normalizeComparison(expected);
      return normalizedAnswers.some((answer) => answer === target || answer.includes(target));
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