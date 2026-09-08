import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkDomainAvailability, registerDomainNamecheap } from "@/lib/domain-provider";
import {
  listOwnedDomains,
  renewDomain,
  sanitizeDnsRecords,
  upsertDomainSettings,
  type ClientDomain,
  type DomainContacts,
  type Nameservers,
} from "@/lib/domain-manager";
import { runDomainProvisioningFlow } from "@/lib/provisioning/domain/orchestrator";
import type { DomainContact } from "@/lib/provisioning/domain/types";
import { notifyEvent } from "@/lib/notifications";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";
import {
  apiDomainOrderSchema,
  domainCheckQuerySchema,
  domainRegisterSchema,
  uuidSchema,
} from "@/lib/schemas";
import type { AdminContext } from "@/lib/admin";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceResult } from "./result";

const FULL_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{2,20})+$/i;

export type Actor = Pick<AdminContext, "userId" | "email" | "role">;

export type DomainCheckResult = {
  available: boolean;
  fullDomain: string;
  name: string;
  extension: string;
  status: string;
  price?: number | null;
  renewal?: number | null;
  source?: string;
  error?: string;
};

/* --------------------------------------------------------------------- *
 * Public: list active extensions (price from DB, never hard-coded)
 * --------------------------------------------------------------------- */

export async function listExtensions(): Promise<ServiceResult<{ extensions: unknown[] }>> {
  const { data, error } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration, renewal, ideal_for")
    .eq("active", true)
    .order("registration", { ascending: true });

  if (error || !data) {
    serverLogError("service:domain.listExtensions", error ?? new Error("extensions query returned null"));
    return fail(500, "Não foi possível carregar as extensões.");
  }
  return { ok: true, extensions: data };
}

/* --------------------------------------------------------------------- *
 * Public: domain search — term + extensions, with per-extension price
 * (authoritative from the DB catalog, never hard-coded)
 * --------------------------------------------------------------------- */

export type DomainSearchResult = {
  term: string;
  name: string;
  suggestions: Array<{
    extension: string;
    fullDomain: string;
    price: number;
    renewal: number | null;
  }>;
};

export async function search(input: {
  term?: unknown;
  limit?: unknown;
}): Promise<ServiceResult<DomainSearchResult>> {
  const term = String(input.term ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!term || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(term) || term.length < 2 || term.length > 63) {
    return fail(400, "Termo de pesquisa inválido.");
  }

  const limit = Math.min(Number(input.limit ?? 5) || 5, 10);

  const { data: extensions } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration, renewal")
    .eq("active", true)
    .order("registration", { ascending: true })
    .limit(limit);

  if (!extensions?.length) {
    return fail(500, "Não foi possível carregar as extensões.");
  }

  const suggestions = extensions.map((ext) => ({
    extension: String(ext.extension),
    fullDomain: term + String(ext.extension),
    price: Number(ext.registration ?? 0),
    renewal: ext.renewal != null ? Number(ext.renewal) : null,
  }));

  return { ok: true, term, name: term, suggestions };
}

/* --------------------------------------------------------------------- *
 * Public: availability check (rate limit + validation handled by the route)
 * --------------------------------------------------------------------- */

export async function checkAvailability(nameInput: string, extensionInput: string): Promise<ServiceResult<DomainCheckResult>> {
  const parsed = domainCheckQuerySchema.safeParse({
    name: nameInput,
    extension: extensionInput,
  });
  if (!parsed.success) {
    return fail(400, "Nome de domínio inválido. Use apenas letras, números e hífens.");
  }

  const { name: rawName, extension } = parsed.data;
  const name = rawName.toLowerCase().replace(/\s+/g, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) || name.length < 2) {
    return fail(400, "Nome de domínio inválido. Use apenas letras, números e hífens.");
  }

  const { data: ext } = await supabaseAdmin
    .from("domain_extensions")
    .select("*")
    .eq("extension", extension)
    .eq("active", true)
    .maybeSingle();

  if (!ext) {
    return fail(400, "Extensão de domínio não suportada.");
  }

  const fullDomain = `${name}${extension}`;

  // 1. Local registry — if we already know it's taken, short-circuit.
  const { data: existing } = await supabaseAdmin
    .from("domains")
    .select("status")
    .eq("full_domain", fullDomain)
    .maybeSingle();

  const locallyTaken = existing?.status === "registered" || existing?.status === "reserved";
  if (locallyTaken) {
    return {
      ok: true,
      available: false,
      fullDomain,
      name,
      extension,
      status: existing.status,
      price: ext.registration,
      source: "registry",
    };
  }

  // 2. Real availability via RDAP (default) or Namecheap (when configured).
  const check = await checkDomainAvailability(fullDomain);

  if (!check.available) {
    await supabaseAdmin
      .from("domains")
      .upsert(
        {
          name,
          extension,
          full_domain: fullDomain,
          status: "registered",
          price: ext.registration,
        },
        { onConflict: "full_domain" },
      );
    return {
      ok: true,
      available: false,
      fullDomain,
      name,
      extension,
      status: "registered",
      price: ext.registration,
      source: check.source,
      error: check.message ?? "Indisponível para registo.",
    };
  }

  // 3. Available — record the positive lookup.
  const { data: lookup, error: lookupError } = await supabaseAdmin
    .from("domains")
    .upsert(
      {
        name,
        extension,
        full_domain: fullDomain,
        status: "available",
        price: ext.registration,
      },
      { onConflict: "full_domain" },
    )
    .select()
    .single();

  if (lookupError) {
    serverLogError("service:domain.checkAvailability", lookupError);
    return fail(500, "Erro ao registar a consulta.");
  }

  return {
    ok: true,
    available: true,
    fullDomain,
    name,
    extension,
    status: lookup.status,
    price: lookup.price,
    renewal: ext.renewal,
    source: check.source,
  };
}

/* --------------------------------------------------------------------- *
 * Public: RDAP WHOIS lookup + local expiry
 * --------------------------------------------------------------------- */

type RdapPayload = {
  entities?: Array<{ roles?: string[]; vcardArray?: unknown[] }>;
  events?: Array<{ eventAction?: string; eventDate?: string }>;
  status?: string | string[];
};

export type WhoisResult = {
  domain: string;
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  lastChanged: string | null;
  status: string[];
};

async function rdapWhois(fullDomain: string): Promise<WhoisResult | null> {
  const dot = fullDomain.lastIndexOf(".");
  const tld = fullDomain.slice(dot + 1).toLowerCase();

  let servers: string[] = [];
  try {
    const res = await fetch("https://data.iana.org/rdap/dns.json", {
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { services: [string[], string[]][] };
    const match = json.services.find(([tlds]) => tlds.some((t) => t.toLowerCase() === tld));
    servers = match?.[1] ?? [];
  } catch {
    return null;
  }

  for (const base of servers) {
    try {
      const response = await fetch(
        `${base.replace(/\/$/, "")}/domain/${encodeURIComponent(fullDomain)}`,
        { signal: AbortSignal.timeout(8000), redirect: "follow" },
      );
      if (response.status !== 200) continue;
      const data = (await response.json()) as RdapPayload;

      const registrar =
        data.entities?.find((e) => (e.roles ?? []).includes("registrar")) ?? data.entities?.[0];
      let registrarName: string | null = null;
      const card = registrar?.vcardArray?.[1];
      if (Array.isArray(card)) {
        const fn = card.find((row) => Array.isArray(row) && row[0] === "fn");
        if (fn && typeof fn[3] === "string") registrarName = fn[3];
      }

      const events: Record<string, string> = {};
      for (const ev of data.events ?? []) {
        if (ev.eventAction && ev.eventDate && !events[ev.eventAction]) {
          events[ev.eventAction] = ev.eventDate;
        }
      }

      return {
        domain: fullDomain,
        registrar: registrarName,
        registrationDate: events.registration ?? null,
        expirationDate: events.expiration ?? null,
        lastChanged: events["last changed"] ?? null,
        status: Array.isArray(data.status) ? data.status : data.status ? [data.status] : [],
      };
    } catch {
      // try next server
    }
  }

  return null;
}

export async function whois(
  domainInput: string,
): Promise<ServiceResult<{ whois: (WhoisResult & { localExpires?: string | null; externalUrl: string }) | null }>> {
  const domain = domainInput.trim().toLowerCase();
  if (!domain || !FULL_DOMAIN_RE.test(domain) || domain.length > 253) {
    return fail(400, "Dominio invalido.");
  }

  const [remote, { data: local }] = await Promise.all([
    rdapWhois(domain),
    supabaseAdmin.from("domains").select("expires_at").eq("full_domain", domain).maybeSingle(),
  ]);

  const base: WhoisResult = {
    domain,
    registrar: null,
    registrationDate: null,
    expirationDate: null,
    lastChanged: null,
    status: [],
    ...(remote ?? {}),
  };

  return {
    ok: true,
    whois: {
      ...base,
      localExpires: local?.expires_at ?? null,
      externalUrl: `https://who.is/whois/${domain}`,
    },
  };
}

/* --------------------------------------------------------------------- *
 * Public: domain order (reserves the domain while unpaid)
 * --------------------------------------------------------------------- */

export async function createOrder(input: unknown): Promise<ServiceResult<{ order: unknown }>> {
  const parsed = apiDomainOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail(400, "Preencha todos os campos correctamente.");
  }

  const { name: contactName, email, fullDomain, extension } = parsed.data;

  const { data: ext } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration")
    .eq("extension", extension)
    .eq("active", true)
    .maybeSingle();

  if (!ext) {
    return fail(400, "Extensão de domínio não suportada.");
  }

  const domainName = extension && fullDomain.endsWith(extension) ? fullDomain.slice(0, -extension.length) : null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(domainName ?? "")) {
    return fail(400, "Nome de domínio inválido.");
  }

  // Re-verify availability before accepting the order so taken domains can't be ordered.
  const { data: existing } = await supabaseAdmin
    .from("domains")
    .select("status")
    .eq("full_domain", fullDomain)
    .maybeSingle();

  const locallyTaken = existing?.status === "registered" || existing?.status === "reserved";
  const check = locallyTaken ? { available: false } : await checkDomainAvailability(fullDomain);

  if (!check.available) {
    return fail(409, "Este domínio já não está disponível para registo.");
  }

  // Price is authoritative from the database, never from the client.
  const price = ext.registration;

  const { data, error } = await supabaseAdmin
    .from("domain_orders")
    .insert({ full_domain: fullDomain, extension, name: contactName, email, price })
    .select()
    .single();

  if (error) {
    serverLogError("service:domain.createOrder", error);
    return fail(500, "Não foi possível registar o pedido.");
  }

  // Reserve the domain locally so it can't be ordered again while this order is open.
  await supabaseAdmin
    .from("domains")
    .upsert(
      {
        name: domainName,
        extension,
        full_domain: fullDomain,
        status: "reserved",
        price,
      },
      { onConflict: "full_domain" },
    );

  await logAudit({
    action: AUDIT.DOMAIN_ORDER_CREATED,
    entity: "domain_order",
    entityId: data?.id,
    actorEmail: email,
    meta: { fullDomain, extension, price },
  });

  return { ok: true, order: data };
}

/* --------------------------------------------------------------------- *
 * Public: register an already-reserved domain via the configured registrar
 * --------------------------------------------------------------------- */

export async function registerWithProvider(input: unknown): Promise<ServiceResult<{ tld?: string; configured?: boolean }>> {
  const parsed = domainRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return fail(400, "Domínio em falta.");
  }

  const { orderId, fullDomain, years } = parsed.data;

  if (!process.env.NAMECHEAP_API_USER || !process.env.NAMECHEAP_API_KEY || !process.env.NAMECHEAP_CLIENT_IP) {
    return fail(501, "O registo automático ainda não está ligado. A nossa equipa fará o registo manualmente.");
  }

  // Re-verify availability right before registering to avoid registering a taken domain.
  const check = await checkDomainAvailability(fullDomain);
  if (!check.available) {
    return fail(409, "O domínio já não está disponível.");
  }

  const result = await registerDomainNamecheap({ fullDomain, years: years ?? 1 });

  if (result.ok) {
    await supabaseAdmin
      .from("domains")
      .upsert(
        { full_domain: fullDomain, status: "registered", checked_at: new Date().toISOString() },
        { onConflict: "full_domain" },
      );

    if (orderId) {
      await supabaseAdmin.from("domain_orders").update({ status: "registered" }).eq("id", orderId);
    }

    let customer: { email?: string; name?: string } = {};
    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from("domain_orders")
        .select("email, name")
        .eq("id", orderId)
        .maybeSingle();
      customer = order ?? {};
    }

    await notifyEvent(
      "domain.registered",
      { fullDomain, years: years ?? 1 },
      { recipients: customer.email ? [{ email: customer.email, name: customer.name }] : [] },
    );

    return { ok: true, tld: result.tld };
  }

  return { ok: false, status: 502, error: result.error ?? "Falha ao registar o domínio." };
}

/* --------------------------------------------------------------------- *
 * Admin: re-check / delete a registry row
 * --------------------------------------------------------------------- */

export async function adminRecheck(
  id: string,
  actor: Actor,
  ip?: string,
): Promise<ServiceResult<{ domain: unknown; source?: string; message?: string }>> {
  if (!uuidSchema.safeParse(id).success) {
    return fail(400, "Identificador inválido.");
  }

  const { data: domain, error } = await supabaseAdmin
    .from("domains")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !domain) {
    return fail(404, "Domínio não encontrado.");
  }

  const check = await checkDomainAvailability(domain.full_domain);
  const nextStatus = domain.status === "reserved" ? "reserved" : check.available ? "available" : "registered";

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("domains")
    .update({ status: nextStatus, checked_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    serverLogError("service:domain.adminRecheck", updateError ?? new Error("domain update returned null"));
    return fail(500, "Não foi possível atualizar o domínio.");
  }

  await logAudit({
    action: AUDIT.DOMAIN_RECHECKED,
    entity: "domain",
    entityId: id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { fullDomain: domain.full_domain, status: nextStatus, source: check.source },
  });

  return { ok: true, domain: updated, source: check.source, message: check.message };
}

export async function adminDelete(id: string, actor: Actor, ip?: string): Promise<ServiceResult<{ id: string }>> {
  if (!uuidSchema.safeParse(id).success) {
    return fail(400, "Identificador inválido.");
  }

  const { data: deleted, error } = await supabaseAdmin
    .from("domains")
    .delete()
    .eq("id", id)
    .select("full_domain")
    .single();

  if (error) {
    serverLogError("service:domain.adminDelete", error);
    return fail(500, "Não foi possível eliminar.");
  }

  await logAudit({
    action: AUDIT.DOMAIN_DELETED,
    entity: "domain",
    entityId: id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { fullDomain: deleted?.full_domain },
  });

  return { ok: true, id };
}

/* --------------------------------------------------------------------- *
 * Admin: register a domain order (manual or via Namecheap)
 * --------------------------------------------------------------------- */

export async function adminRegisterByOrder(
  orderId: string,
  actor: Actor,
  ip?: string,
): Promise<ServiceResult<{ mode: "already" | "manual" | "automatic"; tld?: string; note?: string }>> {
  if (!uuidSchema.safeParse(orderId).success) {
    return fail(400, "Identificador inválido.");
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("domain_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return fail(404, "Pedido não encontrado.");
  }

  const fullDomain = order.full_domain;
  const extension = order.extension;
  const domainName = fullDomain.endsWith(extension) ? fullDomain.slice(0, -extension.length) : fullDomain;

  if (order.status === "registered") {
    return { ok: true, mode: "already", note: "Pedido já estava registado." };
  }

  async function markRegistered() {
    await supabaseAdmin
      .from("domains")
      .upsert(
        { name: domainName, extension, full_domain: fullDomain, status: "registered", price: order.price },
        { onConflict: "full_domain" },
      );
    await supabaseAdmin.from("domain_orders").update({ status: "registered" }).eq("id", orderId);
    await logAudit({
      action: AUDIT.DOMAIN_REGISTERED,
      entity: "domain_order",
      entityId: orderId,
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      ip,
      meta: { fullDomain },
    });

    await notifyEvent(
      "domain.registered",
      { fullDomain, years: 1 },
      { recipients: order.email ? [{ email: order.email, name: order.name }] : [] },
    );
  }

  const namecheapConfigured =
    process.env.NAMECHEAP_API_USER && process.env.NAMECHEAP_API_KEY && process.env.NAMECHEAP_CLIENT_IP;

  if (!namecheapConfigured) {
    await markRegistered();
    return { ok: true, mode: "manual", note: "Registo automático desligado — domínio marcado como registado manualmente." };
  }

  const check = await checkDomainAvailability(fullDomain);
  if (!check.available) {
    return { ok: false, status: 409, error: "O domínio já não está disponível para registo." };
  }

  const result = await registerDomainNamecheap({ fullDomain });
  if (!result.ok) {
    return { ok: false, status: 502, error: result.error ?? "Falha ao registar o domínio." };
  }

  await markRegistered();
  return { ok: true, mode: "automatic", tld: result.tld, note: "Domínio registado com sucesso." };
}

/* --------------------------------------------------------------------- *
 * Client: list + manage owned domains
 * --------------------------------------------------------------------- */

export async function clientListDomains(ctx: AuthContext): Promise<ClientDomain[]> {
  return listOwnedDomains(ctx);
}

export type DomainUpdateInput = {
  fullDomain?: string;
  update?: {
    autoRenew?: unknown;
    lock?: unknown;
    transferEnabled?: unknown;
    nameservers?: unknown;
    dns?: unknown;
    contacts?: unknown;
  };
  action?: "renew" | "requestTransfer";
  extraYears?: number;
};

export async function clientUpdateDomain(
  ctx: AuthContext,
  input: DomainUpdateInput,
  ip?: string,
): Promise<ServiceResult<{ domain: ClientDomain; persisted: boolean; actionNote?: string }>> {
  const fullDomain = String(input.fullDomain ?? "").toLowerCase().trim();
  if (!FULL_DOMAIN_RE.test(fullDomain)) {
    return fail(400, "Domínio inválido.");
  }

  const owned = await listOwnedDomains(ctx);
  const domain = owned.find((d) => d.fullDomain === fullDomain);
  if (!domain) {
    return fail(403, "Não tem acesso a este domínio.");
  }

  const next = { ...domain.settings };
  const update = input.update ?? {};

  if (typeof update.autoRenew === "boolean") next.autoRenew = update.autoRenew;
  if (typeof update.lock === "boolean") next.lock = update.lock;
  if (typeof update.transferEnabled === "boolean") next.transferEnabled = update.transferEnabled;

  if (update.nameservers && typeof update.nameservers === "object") {
    const ns = update.nameservers as Partial<Nameservers>;
    const cleaned: Nameservers = {};
    for (const key of ["ns1", "ns2", "ns3", "ns4"] as const) {
      const value = typeof ns[key] === "string" ? ns[key].trim().replace(/\.$/, "") : "";
      if (value) cleaned[key] = value;
    }
    if (Object.keys(cleaned).length > 0) {
      next.nameservers = { ...next.nameservers, ...cleaned };
    }
  }
  if ("dns" in update) {
    next.dns = sanitizeDnsRecords(update.dns);
  }
  if (update.contacts && typeof update.contacts === "object") {
    next.contacts = update.contacts as DomainContacts;
  }

  let actionNote: string | undefined;
  if (input.action === "requestTransfer") {
    next.transferEnabled = true;
    if (!next.transferAuthCode) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      next.transferAuthCode = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 12)
        .toUpperCase();
    }
    actionNote = "Código de transferência gerado.";
  }

  const result = await upsertDomainSettings(ctx, fullDomain, next);

  if (input.action === "renew") {
    const extraYears = Number.isInteger(input.extraYears) ? input.extraYears! : 1;
    const renewed = await renewDomain(fullDomain, Math.min(Math.max(extraYears, 1), 10));
    if (!renewed) {
      serverLogError("service:domain.clientUpdateDomain", new Error("renewDomain returned false"));
      return fail(500, "Não foi possível renovar o domínio.");
    }
    actionNote = "Domínio renovado por mais 1 ano.";
  }

  const refreshed = await listOwnedDomains(ctx);
  const updated = refreshed.find((d) => d.fullDomain === fullDomain);

  await logAudit({
    action: AUDIT.CLIENT_DOMAIN_UPDATED,
    entity: "domain",
    entityId: fullDomain,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    ip,
    meta: { fullDomain, action: input.action, fields: Object.keys(update) },
  });

  return {
    ok: true,
    domain: updated ?? { ...domain, settings: result.settings },
    persisted: result.persisted,
    actionNote,
  };
}

/* --------------------------------------------------------------------- *
 * Admin: provisioning flow (domain register from panel / API)
 * --------------------------------------------------------------------- */

export async function provision(
  input: {
    fullDomain?: string;
    years?: number;
    contact?: DomainContact;
    customerEmail?: string;
    hostingPlan?: string;
    nameservers?: string[];
    paymentVerified?: boolean;
  },
  actor: Actor,
  ip?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const fullDomain = input.fullDomain?.trim().toLowerCase() ?? "";
  if (!fullDomain || !FULL_DOMAIN_RE.test(fullDomain)) {
    return fail(400, "Domínio inválido.");
  }

  const years = Number.isInteger(input.years) ? input.years! : 1;
  if (years < 1 || years > 10) {
    return fail(400, "Duração entre 1 e 10 anos.");
  }

  const result = await runDomainProvisioningFlow({
    fullDomain,
    years,
    contact: input.contact,
    customerEmail: input.customerEmail,
    hostingPlan: input.hostingPlan,
    nameservers: input.nameservers,
    paymentVerified: input.paymentVerified ?? true,
  });

  await logAudit({
    action: AUDIT.PROVISIONING_DOMAIN,
    entity: "domain",
    entityId: fullDomain,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { fullDomain, years },
  });

  return { ...result } as ServiceResult<Record<string, unknown>>;
}

/* --------------------------------------------------------------------- *
 * Cron: find domains expiring within 30 days and notify owners/staff with
 * staged escalation (30d email, 15d reminder, 7d urgent, 1d last call),
 * then prepare auto-renew for domains that reach the final stage.
 * --------------------------------------------------------------------- */

const EXPIRY_STAGES = [
  { stage: "30", days: 30, key: "domain.expiring.30" },
  { stage: "15", days: 15, key: "domain.expiring.15" },
  { stage: "7", days: 7, key: "domain.expiring.7" },
  { stage: "1", days: 1, key: "domain.expiring.1" },
] as const;

export async function expiringDomains(): Promise<
  ServiceResult<{ checked: number; notified: number; renewed: number }>
> {
  const daysMs = 24 * 60 * 60 * 1000;
  const windowDays = 30;
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * daysMs);

  const [{ data: domains, error }, { data: extensions }] = await Promise.all([
    supabaseAdmin
      .from("domains")
      .select("full_domain, extension, expires_at, auto_renew")
      .in("status", ["registered", "active"])
      .not("expires_at", "is", null)
      .lte("expires_at", horizon.toISOString()),
    supabaseAdmin.from("domain_extensions").select("extension, renewal").eq("active", true),
  ]);

  if (error) {
    serverLogError("service:domain.expiringDomains", error);
    return fail(500, "Falha ao consultar domínios.");
  }

  const expiring = (domains ?? []).filter((d) => d.expires_at != null);
  if (!expiring.length) {
    return { ok: true, checked: 0, notified: 0, renewed: 0 };
  }

  const fullDomains = expiring.map((d) => d.full_domain);
  const [{ data: orders }, { data: sentStages }] = await Promise.all([
    supabaseAdmin
      .from("domain_orders")
      .select("full_domain, email, name")
      .in("full_domain", fullDomains),
    supabaseAdmin
      .from("domain_expiration_stages")
      .select("full_domain, stage")
      .in("full_domain", fullDomains),
  ]);
  const ownerBy = new Map((orders ?? []).map((o) => [o.full_domain, o]));
  const stageSet = new Set((sentStages ?? []).map((s) => `${s.full_domain}:${s.stage}`));
  const renewalByExtension = new Map((extensions ?? []).map((e) => [e.extension, Number(e.renewal)]));

  let notified = 0;
  let renewed = 0;

  for (const d of expiring) {
    const expiresAt = new Date(d.expires_at);
    const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / daysMs));
    if (daysLeft <= 0) continue;

    const owner = ownerBy.get(d.full_domain);
    const recipients = owner?.email ? [{ email: owner.email, name: owner.name }] : [];
    const renewalPrice = renewalByExtension.get(d.extension) ?? null;

    // Escalation: send the tightest threshold crossed that was not sent yet.
    const current = EXPIRY_STAGES.find((s) => daysLeft <= s.days);
    if (current && !stageSet.has(`${d.full_domain}:${current.stage}`)) {
      const result = await notifyEvent(
        current.key,
        {
          fullDomain: d.full_domain,
          daysLeft,
          expiresAt: expiresAt.toISOString().slice(0, 10),
          renewalPrice,
        },
        {
          recipients,
          channels: ["email", "dashboard"],
        },
      );
      notified += result.sent;
      await supabaseAdmin
        .from("domain_expiration_stages")
        .upsert(
          { full_domain: d.full_domain, stage: current.stage, sent_at: now.toISOString() },
          { onConflict: "full_domain,stage" },
        );
    }

    // Auto-renew: at the final stage, if auto-renew is enabled on the domain
    // (default true), extend the registration by one year via renewDomain and
    // record it so it never repeats before the new expiry.
    const autoRenew = d.auto_renew ?? true;
    if (autoRenew && daysLeft <= 1 && !stageSet.has(`${d.full_domain}:auto_renew`)) {
      const renewedDomain = await renewDomain(d.full_domain, 1);
      if (renewedDomain) {
        renewed += 1;
        await supabaseAdmin
          .from("domain_expiration_stages")
          .upsert(
            { full_domain: d.full_domain, stage: "auto_renew", sent_at: now.toISOString() },
            { onConflict: "full_domain,stage" },
          );
        await logAudit({
          action: AUDIT.DOMAIN_AUTO_RENEW,
          entity: "domain",
          entityId: d.full_domain,
          meta: { daysLeft, source: "cron" },
        });
        await notifyEvent(
          "domain.autoRenewed",
          { fullDomain: d.full_domain, renewalPrice },
          { recipients, channels: ["email", "dashboard"] },
        );
      }
    }
  }

  return { ok: true, checked: expiring.length, notified, renewed };
}

/* --------------------------------------------------------------------- *
 * Admin: domain order status + deletion (panel orders management)
 * --------------------------------------------------------------------- */

export async function setOrderStatus(
  id: string,
  status: string,
  actor: Actor,
  ip?: string,
): Promise<ServiceResult<{ order: unknown }>> {
  if (!uuidSchema.safeParse(id).success) {
    return fail(400, "Identificador inválido.");
  }

  const { data, error } = await supabaseAdmin
    .from("domain_orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return fail(404, "Pedido não encontrado.");
  }

  await logAudit({
    action: AUDIT.ORDER_STATUS,
    entity: "domain_order",
    entityId: id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { status },
  });

  if (status === "paid") {
    await notifyEvent(
      "payment.successful",
      { fullDomain: data.full_domain, price: data.price },
      { recipients: data.email ? [{ email: data.email, name: data.name }] : [] },
    );
  }

  return { ok: true, order: data };
}

export async function deleteOrder(id: string, actor: Actor, ip?: string): Promise<ServiceResult<{ id: string }>> {
  if (!uuidSchema.safeParse(id).success) {
    return fail(400, "Identificador inválido.");
  }

  const { error } = await supabaseAdmin.from("domain_orders").delete().eq("id", id);
  if (error) {
    serverLogError("service:domain.deleteOrder", error);
    return fail(500, "Não foi possível eliminar.");
  }

  await logAudit({
    action: AUDIT.ORDER_DELETED,
    entity: "domain_order",
    entityId: id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
  });

  return { ok: true, id };
}