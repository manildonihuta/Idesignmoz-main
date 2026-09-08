import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AuthContext } from "@/lib/client";

export type DnsRecord = {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl?: number | "";
  priority?: number | "";
};

export type Nameservers = {
  ns1?: string;
  ns2?: string;
  ns3?: string;
  ns4?: string;
};

export type ContactCard = {
  name?: string;
  org?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
};

export type DomainContacts = {
  registrant?: ContactCard;
  admin?: ContactCard;
  technical?: ContactCard;
  billing?: ContactCard;
};

export type DomainSettings = {
  nameservers: Nameservers;
  dns: DnsRecord[];
  lock: boolean;
  transferEnabled: boolean;
  transferAuthCode?: string;
  autoRenew: boolean;
  contacts: DomainContacts;
  updatedAt?: string;
};

export type ClientDomain = {
  fullDomain: string;
  name: string;
  extension: string;
  status: string;
  price?: number | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  autoRenew: boolean;
  lock: boolean;
  settings: DomainSettings;
};

const SETTINGS_TABLE = "domain_settings";

export const DEFAULT_SETTINGS: DomainSettings = {
  nameservers: { ns1: "ns1.idesignmoz.com", ns2: "ns2.idesignmoz.com" },
  dns: [],
  lock: true,
  transferEnabled: false,
  autoRenew: true,
  contacts: {},
};

const DNS_TYPES = new Set([
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "SRV",
  "NS",
  "CAA",
  "TXT",
  "PTR",
  "SOA",
]);

export function sanitizeDnsRecords(records: unknown | undefined): DnsRecord[] {
  if (!Array.isArray(records)) return [];
  const out: DnsRecord[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "").toUpperCase();
    const name = String(r.name ?? "").trim().replace(/\.$/, "");
    const value = String(r.value ?? "").trim();
    if (!type || !name || !value) continue;
    const ttl = r.ttl === "" || r.ttl === undefined ? "" : Number(r.ttl);
    const priority = r.priority === "" || r.priority === undefined ? "" : Number(r.priority);
    out.push({
      id: String(r.id ?? crypto.randomUUID()),
      type,
      name,
      value,
      ttl: Number.isFinite(ttl) ? ttl : "",
      priority: Number.isFinite(priority) ? priority : "",
    });
  }
  return out;
}

async function readSettings(userId: string, fullDomain: string): Promise<DomainSettings> {
  const { data, error } = await supabaseAdmin
    .from(SETTINGS_TABLE)
    .select("settings, updated_at")
    .or(`user_id.eq.${userId},full_domain.eq.${fullDomain}`)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  if (error || !data?.settings) {
    return { ...DEFAULT_SETTINGS };
  }
  const stored = data.settings as Partial<DomainSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    nameservers: { ...DEFAULT_SETTINGS.nameservers, ...stored.nameservers },
    contacts: { ...stored.contacts },
    dns: sanitizeDnsRecords(stored.dns),
    updatedAt: data.updated_at ?? undefined,
  };
}

async function writeSettings(
  userId: string,
  fullDomain: string,
  settings: DomainSettings,
): Promise<boolean> {
  const { error } = await supabaseAdmin.from(SETTINGS_TABLE).upsert(
    {
      user_id: userId,
      full_domain: fullDomain,
      settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,full_domain" },
  );
  return !error;
}

export async function listOwnedDomains(ctx: AuthContext): Promise<ClientDomain[]> {
  if (!ctx.userId && !ctx.email) return [];

  const { data: orders, error: orderError } = await supabaseAdmin
    .from("domain_orders")
    .select("*")
    .or(`user_id.eq.${ctx.userId ?? "''"},email.eq.${ctx.email ?? "''"}`);

  const ownedFullDomains = new Set<string>();
  if (!orderError && orders) {
    for (const order of orders) {
      if (typeof order.full_domain === "string" && order.full_domain) {
        ownedFullDomains.add(order.full_domain);
      }
    }
  }

  const { data: existingSettings } = await supabaseAdmin
    .from(SETTINGS_TABLE)
    .select("full_domain")
    .eq("user_id", ctx.userId ?? "");

  if (existingSettings) {
    for (const row of existingSettings) {
      if (typeof row.full_domain === "string" && row.full_domain) {
        ownedFullDomains.add(row.full_domain);
      }
    }
  }

  if (ownedFullDomains.size === 0) return [];

  const fullDomains = Array.from(ownedFullDomains);
  const { data: registry, error: registryError } = await supabaseAdmin
    .from("domains")
    .select("*")
    .in("full_domain", fullDomains);

  const byFullDomain = new Map<string, Record<string, unknown>>();
  if (!registryError && registry) {
    for (const row of registry) {
      if (typeof row.full_domain === "string") {
        byFullDomain.set(row.full_domain, row);
      }
    }
  }

  const domains: ClientDomain[] = [];
  for (const fullDomain of fullDomains) {
    const registryRow = byFullDomain.get(fullDomain);
    const dot = fullDomain.lastIndexOf(".");
    const name = dot > 0 ? fullDomain.slice(0, dot) : fullDomain;
    const extension = dot > 0 ? fullDomain.slice(dot) : "";
    const status = typeof registryRow?.status === "string" ? registryRow.status : "registered";

    // Fall back to registered for local registry misses so owned domains still appear.
    const settings = await readSettings(ctx.userId ?? ctx.email ?? "", fullDomain);

    domains.push({
      fullDomain,
      name,
      extension,
      status,
      price:
        typeof registryRow?.price === "number"
          ? registryRow.price
          : typeof registryRow?.price === "string"
            ? Number(registryRow.price)
            : null,
      expiresAt: registryRow?.expires_at ? String(registryRow.expires_at) : null,
      createdAt: registryRow?.created_at ? String(registryRow.created_at) : null,
      autoRenew: settings.autoRenew,
      lock: settings.lock,
      settings,
    });
  }

  domains.sort((a, b) => a.fullDomain.localeCompare(b.fullDomain));
  return domains;
}

export async function getDomainSettingsForUser(
  ctx: AuthContext,
  fullDomain: string,
): Promise<DomainSettings> {
  return readSettings(ctx.userId ?? ctx.email ?? "", fullDomain);
}

export async function upsertDomainSettings(
  ctx: AuthContext,
  fullDomain: string,
  settings: DomainSettings,
): Promise<{ ok: boolean; settings: DomainSettings; persisted: boolean }> {
  const ownerKey = ctx.userId ?? ctx.email;
  if (!ownerKey) {
    return { ok: false, settings, persisted: false };
  }
  const saved = await writeSettings(ownerKey, fullDomain, settings);
  return { ok: true, settings, persisted: saved };
}

export async function renewDomain(fullDomain: string, extraYears = 1): Promise<boolean> {
  if (!Number.isInteger(extraYears) || extraYears < 1 || extraYears > 10) {
    return false;
  }
  const { data, error } = await supabaseAdmin
    .from("domains")
    .select("expires_at")
    .eq("full_domain", fullDomain)
    .maybeSingle();

  if (error) return false;

  const base = data?.expires_at ? new Date(String(data.expires_at)) : new Date();
  const now = new Date();
  const anchor = base > now ? base : now;
  anchor.setUTCFullYear(anchor.getUTCFullYear() + extraYears);

  const { error: updateError } = await supabaseAdmin
    .from("domains")
    .update({ expires_at: anchor.toISOString(), status: "registered" })
    .eq("full_domain", fullDomain);

  return !updateError;
}

export { DNS_TYPES };