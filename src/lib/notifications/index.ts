import "server-only";

import { CHANNELS } from "./channels";
import { EVENTS, type EventKey } from "./events";
import { resolveStaffRecipients } from "./recipients";
import type { ChannelKey, NotifRecipient, NotificationPayload, NotifyOptions } from "./types";

export type NotifyResult = { ok: boolean; sent: number; failed: number };

function dedupeRecipients(list: NotifRecipient[]): NotifRecipient[] {
  const seen = new Set<string>();
  const out: NotifRecipient[] = [];
  for (const recipient of list) {
    const id = recipient.userId ?? recipient.email ?? "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(recipient);
  }
  return out;
}

/**
 * Central notification entry point. Renders an event (see EVENTS) and
 * delivers it through the requested channels (default: email + dashboard)
 * to the given explicit recipients and/or all staff with the event roles.
 *
 * Example:
 *   await notifyEvent("domain.registered", { fullDomain, years: 1 }, {
 *     recipients: [{ email: order.email, name: order.name }],
 *   });
 */
export async function notifyEvent(
  key: EventKey,
  payload: NotificationPayload = {},
  options: NotifyOptions = {},
): Promise<NotifyResult> {
  const def = EVENTS[key];
  const channels = (options.channels ?? ["email", "dashboard"]) as ChannelKey[];
  const roles = options.roles ?? def.roles;
  const recipients = dedupeRecipients([
    ...(options.recipients ?? []),
    ...(roles.length ? await resolveStaffRecipients(roles) : []),
  ]);

  const notif = def.render(payload);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    for (const channelKey of channels) {
      const channel = CHANNELS[channelKey];
      if (!channel?.enabled) continue;
      try {
        await channel.send(recipient, notif, payload);
        sent += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { ok: failed === 0, sent, failed };
}

export { EVENTS } from "./events";
export type { EventKey } from "./events";
export { CHANNELS } from "./channels";
export type { NotifRecipient, NotificationPayload, NotifyOptions, ChannelKey } from "./types";