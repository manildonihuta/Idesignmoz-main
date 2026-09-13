import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { notifyEvent } from "@/lib/notifications";
import { resolveUserEmail } from "@/lib/notifications/recipients";
import type { NotificationPayload } from "@/lib/notifications";

export const EMAIL_QUOTA_THRESHOLDS = [
  { percent: 80, metaKey: "quotaAlertSent80", event: "email.quota.80" },
  { percent: 95, metaKey: "quotaAlertSent95", event: "email.quota.95" },
] as const;

/**
 * Threshold-based quota alerts for email services. Called after every usage
 * sync. Fires a notification (dashboard + email) once per crossing and clears
 * the flag when usage drops below the threshold, so a later re-crossing
 * re-alerts. Alert state is kept in email_services.meta to avoid spam.
 */
export async function evaluateEmailQuotaAlerts(input: {
  serviceId: string;
  customerId: string | null;
  domain: string;
  meta: Record<string, unknown> | null;
  storageLimitGb: number;
  storageUsedGb: number;
}): Promise<void> {
  const { serviceId, customerId, domain, meta, storageLimitGb, storageUsedGb } = input;
  const percent = storageLimitGb > 0 ? Math.round((storageUsedGb / storageLimitGb) * 100) : 0;

  const nextMeta: Record<string, unknown> = { ...(meta ?? {}) };
  let changed = false;

  for (const threshold of EMAIL_QUOTA_THRESHOLDS) {
    const prevSent = nextMeta[threshold.metaKey] === true;
    if (percent >= threshold.percent && !prevSent) {
      try {
        const email = customerId ? await resolveUserEmail(customerId) : undefined;
        await notifyEvent(threshold.event, {
          domain,
          percent,
          storageUsedGb,
          storageLimitGb,
        } as NotificationPayload, {
          recipients: customerId ? [{ userId: customerId, email }] : [],
        });
      } catch (e) {
        serverLogError("service:email-quota.alert.send", e);
      }
      nextMeta[threshold.metaKey] = true;
      nextMeta[`${threshold.metaKey}At`] = new Date().toISOString();
      changed = true;
    } else if (percent < threshold.percent && prevSent) {
      delete nextMeta[threshold.metaKey];
      delete nextMeta[`${threshold.metaKey}At`];
      changed = true;
    }
  }

  if (!changed) return;

  const { error } = await supabaseAdmin
    .from("email_services")
    .update({ meta: nextMeta, updated_at: new Date().toISOString() })
    .eq("id", serviceId);
  if (error) {
    serverLogError("service:email-quota.alert.meta", error);
  }
}