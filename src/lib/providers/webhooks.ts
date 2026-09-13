import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { encryptSecret, decryptSecret, type EncryptedSecret } from "@/lib/provisioning/credentials";
import { logProviderActivity } from "./activity";

/**
 * Provider webhooks — both outbound delivery endpoints and inbound receipts.
 * Outbound payloads are signed with HMAC-SHA256 (`t=<ts>;v1=<sig>` where the
 * signature covers `<t>.<rawBody>`); inbound receipts are persisted with a
 * unique idempotency_key so duplicate webhooks are recognised and dropped.
 */

export type WebhookEndpointRow = {
  id: string;
  provider_id: string | null;
  service: string;
  name: string;
  url: string;
  status: string;
  events: string[];
  last_delivered_at: string | null;
  last_status: string | null;
  created_at: string;
};

export type SafeWebhookEndpoint = {
  id: string;
  providerId: string | null;
  service: string;
  name: string;
  url: string;
  status: string;
  events: string[];
  lastDeliveredAt: string | null;
  lastStatus: string | null;
  createdAt: string;
};

export type InboundEventStatus = "queued" | "processing" | "processed" | "failed" | "ignored" | "rejected";

export type InboundEventRow = {
  id: string;
  provider_id: string | null;
  source: string;
  event: string;
  payload: unknown;
  idempotency_key: string;
  signature_verified: boolean;
  status: InboundEventStatus;
  error: string | null;
  retry_count: number;
  created_at: string;
  processed_at: string | null;
};

function encodeSecret(plain: string): string {
  return JSON.stringify(encryptSecret(plain));
}

function decodeSecret(encryptedData: string): string {
  return decryptSecret(JSON.parse(encryptedData) as EncryptedSecret);
}

/**
 * Verifies an HMAC-SHA256 webhook signature presented in the
 * `x-idesign-signature` header format `t=<unixSeconds>;v1=<hex>`.
 * Covers the raw body, so a signature only fixed to the JSON body stays valid.
 */
export function verifyWebhookSignature(
  signatureHeader: string | null,
  rawBody: string,
  secret: string,
  toleranceSec = 300,
): { ok: boolean; reason?: string } {
  if (!signatureHeader) return { ok: false, reason: "Assinatura ausente." };
  const parts = Object.fromEntries(
    signatureHeader
      .split(";")
      .map((part) => part.split("=", 2) as [string, string | undefined])
      .filter(([key]) => key)
      .map(([key, value]) => [key, value ?? ""]),
  );
  const timestamp = parts["t"];
  const provided = parts["v1"];
  if (!timestamp || !provided) return { ok: false, reason: "Formato de assinatura inválido." };

  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(ageSec) || ageSec > toleranceSec) return { ok: false, reason: "Assinatura expirada." };

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "Assinatura inválida." };
  return { ok: true };
}

export function signWebhookPayload(rawBody: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp};v1=${signature}`;
}

function mapEndpoint(row: WebhookEndpointRow): SafeWebhookEndpoint {
  return {
    id: row.id,
    providerId: row.provider_id,
    service: row.service,
    name: row.name,
    url: row.url,
    status: row.status,
    events: row.events,
    lastDeliveredAt: row.last_delivered_at,
    lastStatus: row.last_status,
    createdAt: row.created_at,
  };
}

export async function listWebhookEndpoints(providerId?: string): Promise<SafeWebhookEndpoint[]> {
  let query = supabaseAdmin
    .from("provider_webhooks")
    .select("provider_webhooks.*, providers (slug)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (providerId) query = query.eq("provider_id", providerId);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data ?? []).map((row) => {
    const mapped = mapEndpoint(row as unknown as WebhookEndpointRow);
    const provider = (row as unknown as { providers: { slug: string } | { slug: string }[] | null }).providers;
    const slug = Array.isArray(provider) ? provider[0]?.slug : provider?.slug;
    return { ...mapped, providerSlug: slug ?? undefined };
  }) as SafeWebhookEndpoint[];
}

export async function saveWebhookEndpoint(input: {
  id?: string;
  providerId?: string | null;
  service: string;
  name: string;
  url: string;
  secret?: string;
  events?: string[];
  status?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const url = input.url.trim();
  if (!/^https:\/\//i.test(url)) return { ok: false, error: "O URL tem de usar HTTPS." };

  const row: Record<string, unknown> = {
    provider_id: input.providerId ?? null,
    service: input.service,
    name: input.name.trim(),
    url,
    events: Array.isArray(input.events) ? input.events : [],
    status: input.status === "inactive" ? "inactive" : "active",
  };
  if (input.secret && input.secret.trim()) row.secret_cipher = encodeSecret(input.secret.trim());

  if (input.id) {
    const existing: Record<string, unknown> = { ...row };
    delete existing.provider_id;
    delete existing.service;
    const { data, error } = await supabaseAdmin
      .from("provider_webhooks")
      .update(existing)
      .eq("id", input.id)
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Não foi possível guardar o webhook." };
    return { ok: true, id: data.id as string };
  }

  const { data, error } = await supabaseAdmin.from("provider_webhooks").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: "Não foi possível criar o webhook." };
  return { ok: true, id: data.id as string };
}

async function secretForEndpoint(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("provider_webhooks")
    .select("secret_cipher")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const cipher = data.secret_cipher as string | null;
  if (!cipher) return null;
  try {
    return decodeSecret(cipher);
  } catch {
    return null;
  }
}

/** Delivers a signed ping to an endpoint and records the outcome. */
export async function testWebhookEndpoint(id: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabaseAdmin
    .from("provider_webhooks")
    .select("url, events")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Webhook não encontrado." };

  const secret = await secretForEndpoint(id);
  const body = JSON.stringify({ type: "ping", timestamp: new Date().toISOString() });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["x-idesign-signature"] = signWebhookPayload(body, secret);

  try {
    const res = await fetch(data.url as string, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("provider_webhooks")
      .update({ last_delivered_at: now, last_status: String(res.status) })
      .eq("id", id);
    if (!res.ok) return { ok: false, message: `Endpoint respondeu HTTP ${res.status}.` };
    return { ok: true, message: `Endpoint respondeu HTTP ${res.status}.` };
  } catch (err) {
    await logProviderActivity({
      providerId: null,
      event: "webhook.delivery_failed",
      level: "error",
      message: err instanceof Error ? err.message : "Falha na entrega do webhook.",
      meta: { endpointId: id },
    });
    return { ok: false, message: "Não foi possível contactar o endpoint." };
  }
}

export async function deleteWebhookEndpoint(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from("provider_webhooks").delete().eq("id", id);
  return !error;
}

/** Looks up a provider by adapter slug and returns its webhook URLs (for outbound use). */
export async function inboundSecretForProvider(providerSlug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("slug", providerSlug)
    .maybeSingle();
  if (error || !data) return null;
  const { data: webhooks } = await supabaseAdmin
    .from("provider_webhooks")
    .select("id")
    .eq("provider_id", data.id)
    .eq("status", "active")
    .limit(1);
  const endpointId = (webhooks ?? [])[0]?.id as string | undefined;
  if (!endpointId) return null;
  return secretForEndpoint(endpointId);
}

/** Records an inbound (received) webhook; deduplicated by idempotency_key. */
export async function recordInboundEvent(input: {
  providerId?: string | null;
  source: string;
  event: string;
  payload?: unknown;
  idempotencyKey: string;
  signatureVerified: boolean;
}): Promise<{ ok: boolean; duplicate: boolean; eventId?: string }> {
  const key = input.idempotencyKey.length > 300 ? input.idempotencyKey.slice(0, 300) : input.idempotencyKey;
  const { data: existing, error: findError } = await supabaseAdmin
    .from("provider_events")
    .select("id")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (!findError && existing) return { ok: true, duplicate: true, eventId: existing.id as string };

  const { data, error } = await supabaseAdmin
    .from("provider_events")
    .insert({
      provider_id: input.providerId ?? null,
      source: input.source,
      event: input.event,
      payload: input.payload ?? null,
      idempotency_key: key,
      signature_verified: input.signatureVerified,
      status: input.signatureVerified ? "queued" : "rejected",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true };
    serverLogError("infra:webhook:record", error, { source: input.source, event: input.event });
    return { ok: false, duplicate: false };
  }
  if (!input.signatureVerified) {
    await logProviderActivity({
      providerId: input.providerId,
      event: "webhook.rejected",
      level: "warn",
      message: `Webhook rejeitado por assinatura inválida (${input.source}/${input.event}).`,
      meta: { source: input.source },
    });
  }
  return { ok: true, duplicate: false, eventId: data?.id as string };
}

export async function listInboundEvents(opts?: { limit?: number; status?: string }): Promise<InboundEventRow[]> {
  let query = supabaseAdmin.from("provider_events").select("*").order("created_at", { ascending: false }).limit(Math.min(opts?.limit ?? 50, 200));
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data ?? []) as InboundEventRow[];
}

export function newWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}