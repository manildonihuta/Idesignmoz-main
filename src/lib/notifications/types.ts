import type { Role } from "@/lib/security/rbac";

export type ChannelKey = "email" | "dashboard" | "whatsapp" | "sms";

export type NotifRecipient = {
  userId?: string;
  email?: string;
  name?: string;
  /** E.164 phone for future WhatsApp/SMS delivery. */
  phone?: string;
};

export type NotificationPayload = Record<string, unknown>;

export type RenderedNotification = {
  key: string;
  title: string;
  body: string;
  link?: string;
};

export type NotifyOptions = {
  recipients?: NotifRecipient[];
  roles?: readonly Role[];
  channels?: ChannelKey[];
};