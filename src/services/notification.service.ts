import "server-only";

import { notifyEvent, type EventKey } from "@/lib/notifications";
import type { NotificationPayload, NotifyOptions, NotifyResult } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import {
  EXPERIMENTAL_WHATSAPP_EVENTS,
  isWhatsAppConfigured,
  normalizeWhatsAppNumber,
  sendWhatsAppTemplate,
  WA_TEMPLATES,
} from "@/lib/notifications/whatsapp";
import type { AdminContext } from "@/lib/admin";
import { fail, type ServiceResult } from "./result";

export function event(key: EventKey, payload?: NotificationPayload, options?: NotifyOptions): Promise<NotifyResult> {
  return notifyEvent(key, payload ?? {}, options ?? {});
}

export type StaffNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listStaff(ctx: AdminContext): Promise<ServiceResult<{ items: StaffNotification[]; unread: number }>> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("recipient_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    serverLogError("service:notification.listStaff", error);
    return fail(500, "Não foi possível carregar as notificações.");
  }

  const items = (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));

  return { ok: true, items, unread: items.filter((i) => !i.readAt).length };
}

export async function markRead(ctx: AdminContext, id?: string): Promise<ServiceResult<Record<string, unknown>>> {
  const query = supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.userId)
    .is("read_at", null);
  const finalQuery = id ? query.eq("id", id) : query;

  const { error } = await finalQuery;
  if (error) {
    serverLogError("service:notification.markRead", error);
    return fail(500, "Não foi possível atualizar.");
  }

  return { ok: true };
}

export async function whatsappTest(input: {
  phone?: string;
  kind?: string;
}): Promise<ServiceResult<{ to?: string; template?: string }>> {
  if (!isWhatsAppConfigured()) {
    return fail(501, "WhatsApp não configurado. Define WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_ID.");
  }

  const phone = input.phone ?? "";
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) {
    return fail(400, "Número de WhatsApp inválido (ex.: 258841234567).");
  }

  const kind = input.kind ?? "domain.registered";
  const template = WA_TEMPLATES[kind];
  if (!template) {
    return fail(
      400,
      `Evento sem template WhatsApp. Permitidos: ${EXPERIMENTAL_WHATSAPP_EVENTS.join(", ")}.`,
    );
  }

  const meta = defaultPayloadFor(kind);
  const result = await sendWhatsAppTemplate(normalized, {
    name: template.name,
    language: template.language,
    params: template.params(meta),
  });

  if (!result.ok) {
    return fail(400, result.reason ?? "Falha ao enviar mensagem WhatsApp.");
  }

  return { ok: true, to: normalized, template: template.name };
}

function defaultPayloadFor(kind: string): Record<string, unknown> {
  switch (kind) {
    case "hosting.activated":
      return { domain: "exemplo.co.mz", planName: "Profissional" };
    case "invoice.created":
      return { number: "FT-2026-0001" };
    case "project.approved":
      return { title: "Site corporativo" };
    default:
      return { fullDomain: "exemplo.co.mz" };
  }
}