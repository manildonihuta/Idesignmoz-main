import "server-only";

import { sendEmail, emailLayout } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppNumber,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  WA_TEMPLATES,
} from "./whatsapp";
import type { ChannelKey, NotificationPayload, NotifRecipient, RenderedNotification } from "./types";

export type NotificationChannel = {
  key: ChannelKey;
  enabled: boolean;
  send: (
    recipient: NotifRecipient,
    notif: RenderedNotification,
    meta: NotificationPayload,
  ) => Promise<void>;
};

export const EmailChannel: NotificationChannel = {
  key: "email",
  enabled: true,
  async send(recipient, notif) {
    if (!recipient.email) return;
    const html = emailLayout(notif.title, `<p>${notif.body}</p>`);
    await sendEmail({ to: recipient.email, subject: notif.title, html });
  },
};

export const DashboardChannel: NotificationChannel = {
  key: "dashboard",
  enabled: true,
  async send(recipient, notif, meta) {
    if (!recipient.userId) return;
    await supabaseAdmin.from("notifications").insert({
      recipient_id: recipient.userId,
      kind: notif.key,
      title: notif.title,
      body: notif.body,
      link: notif.link ?? null,
      meta,
    });
  },
};

export const WhatsAppChannel: NotificationChannel = {
  key: "whatsapp",
  enabled: isWhatsAppConfigured(),
  /**
   * WhatsApp Business API (Cloud API). Additive-only: without credentials or
   * phone it no-ops, and it NEVER throws — failures are swallowed so critical
   * email/dashboard delivery is never affected.
   */
  async send(recipient, notif, meta) {
    if (!isWhatsAppConfigured()) return;
    if (!recipient.phone) return;
    if (!normalizeWhatsAppNumber(recipient.phone)) return;

    const template = WA_TEMPLATES[notif.key];
    if (template) {
      await sendWhatsAppTemplate(recipient.phone, {
        name: template.name,
        language: template.language,
        params: template.params(meta),
      });
      return;
    }
    await sendWhatsAppText(recipient.phone, notif.body);
  },
};

export const SmsChannel: NotificationChannel = {
  key: "sms",
  enabled: false,
  async send() {
    /* futuro: canal SMS */
  },
};

export const CHANNELS: Record<ChannelKey, NotificationChannel> = {
  email: EmailChannel,
  dashboard: DashboardChannel,
  whatsapp: WhatsAppChannel,
  sms: SmsChannel,
};