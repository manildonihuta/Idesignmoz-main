import "server-only";

import { serverLogError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Auditable, non-sensitive email lifecycle trail. Passwords and secrets are
 * NEVER recorded here — only actions, ids and safe metadata.
 */
export async function logEmailActivity(input: {
  serviceId: string;
  mailboxId?: string | null;
  actor?: string | null;
  action: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("email_activity_logs").insert({
    email_service_id: input.serviceId,
    mailbox_id: input.mailboxId ?? null,
    actor: input.actor ?? "system",
    action: input.action,
    details: input.details ?? {},
  });
  if (error) {
    serverLogError("email:activity", error);
  }
}