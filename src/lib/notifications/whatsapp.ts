import "server-only";

import type { NotificationPayload } from "./types";

export const WHATSAPP_GRAPH_BASE = "https://graph.facebook.com";

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/**
 * Best-effort normalization to E.164 (+CC NNN...). Returns the normalized
 * number or null when it cannot be made into a plausible value.
 */
export function normalizeWhatsAppNumber(value: string): string | null {
  const digitsOnly = value.replace(/[^\d]/g, "");
  const without00 = digitsOnly.startsWith("00") ? digitsOnly.slice(2) : digitsOnly;
  if (without00.length < 8 || without00.length > 15) return null;
  return `+${without00}`;
}

export type WhatsAppSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; reason: string; status?: number };

async function postMessage(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { ok: false, reason: "WhatsApp não configurado (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_ID)" };

  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const url = `${WHATSAPP_GRAPH_BASE}/${apiVersion}/${phoneId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, reason: text || `HTTP ${response.status}`, status: response.status };
    }

    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Sends a free-form text message (only valid for user-initiated conversations). */
export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  const phone = normalizeWhatsAppNumber(to);
  if (!phone) return { ok: false, reason: "Número de WhatsApp inválido" };
  return postMessage({ to: phone, type: "text", text: { body, preview_url: false } });
}

/**
 * Sends an approved Message Template (cloud-api type "template").
 * The template name must exist in the WhatsApp Business phone number.
 */
export async function sendWhatsAppTemplate(
  to: string,
  input: { name: string; language: string; params?: string[] },
): Promise<WhatsAppSendResult> {
  const phone = normalizeWhatsAppNumber(to);
  if (!phone) return { ok: false, reason: "Número de WhatsApp inválido" };
  const params = (input.params ?? []).filter((p) => p != null && p !== "");

  return postMessage({
    to: phone,
    type: "template",
    template: {
      name: input.name,
      language: { code: input.language },
      ...(params.length
        ? { components: [{ type: "body" as const, parameters: params.map((p) => ({ type: "text" as const, text: String(p) })) }] }
        : {}),
    },
  });
}

export type WhatsAppTemplate = {
  name: string;
  language: string;
  /** Ordered message parameters; each maps to {{1}}, {{2}}, … in the template body. */
  params: (meta: NotificationPayload) => string[];
  /** PT body (for reference — real text lives in the Meta template). */
  ptBody: string;
  /** Example text provided by the client (reference). */
  enExample: string;
};

/**
 * Template metadata per event. The names must be created/approved in
 * WhatsApp Business Manager for the WHATSAPP_PHONE_ID before use.
 * WhatsApp is additive: failures here never block email/dashboard.
 */
export const WA_TEMPLATES: Partial<Record<string, WhatsAppTemplate>> = {
  "domain.registered": {
    name: "domain_registered",
    language: "pt_PT",
    params: (meta) => [String(meta.fullDomain ?? "")],
    ptBody: "O domínio {{1}} foi registado com sucesso.",
    enExample: "Your domain has been successfully registered.",
  },
  "hosting.activated": {
    name: "hosting_activated",
    language: "pt_PT",
    params: (meta) => [String(meta.domain ?? ""), String(meta.planName ?? "")],
    ptBody: "A tua conta de alojamento está ativa em {{1}} (plano {{2}}).",
    enExample: "Your hosting account is now active.",
  },
  "invoice.created": {
    name: "invoice_ready",
    language: "pt_PT",
    params: (meta) => [String(meta.number ?? "")],
    ptBody: "A tua fatura {{1}} está pronta.",
    enExample: "Your invoice is ready.",
  },
  "project.approved": {
    name: "project_approval",
    language: "pt_PT",
    params: (meta) => [String(meta.title ?? "")],
    ptBody: "O teu projeto de website ({{1}}) requer a tua aprovação.",
    enExample: "Your website project requires approval.",
  },
};

export const EXPERIMENTAL_WHATSAPP_EVENTS = Object.keys(WA_TEMPLATES);