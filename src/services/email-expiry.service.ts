import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { selectEmailProvider } from "@/lib/provisioning/email/registry";
import { notifyEvent } from "@/lib/notifications";
import { resolveUserEmail } from "@/lib/notifications/recipients";
import { fail, type ServiceResult } from "./result";

const DAYS_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_DAYS = 30;

const EXPIRY_STAGES = [
  { stage: "30", days: 30, key: "email.expiring.30" },
  { stage: "15", days: 15, key: "email.expiring.15" },
  { stage: "7", days: 7, key: "email.expiring.7" },
  { stage: "1", days: 1, key: "email.expiring.1" },
] as const;

type ExpiryRow = {
  id: string;
  customer_id: string | null;
  domain: string;
  status: string;
  expires_at: string | null;
  provider_status: string | null;
  meta: Record<string, unknown> | null;
};

/**
 * Email lifecycle cron. Mirrors the domain expiry pipeline:
 *  - staged reminders (30/15/7/1 days) to customers + staff, tracked per
 *    service in meta (expiryStageSent) so each stage fires only once;
 *  - services that are already expired and still "active" are suspended via
 *    the provider and marked in meta (expirySuspendedAt). No DB migration is
 *    needed — all contact state lives in email_services.meta.
 */
export async function checkExpiringEmailServices(): Promise<
  ServiceResult<{ checked: number; notified: number; suspended: number }>
> {
  const now = new Date();
  const horizon = new Date(now.getTime() + REMINDER_WINDOW_DAYS * DAYS_MS);
  const nowIso = now.toISOString();

  const [expiringRes, expiredRes] = await Promise.all([
    supabaseAdmin
      .from("email_services")
      .select("id, customer_id, domain, status, expires_at, provider_status, meta")
      .in("status", ["active", "provisioning"])
      .not("expires_at", "is", null)
      .gte("expires_at", nowIso)
      .lte("expires_at", horizon.toISOString()),
    supabaseAdmin
      .from("email_services")
      .select("id, customer_id, domain, status, expires_at, provider_status, meta")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .lt("expires_at", nowIso),
  ]);

  if (expiringRes.error) {
    serverLogError("service:email-expiry.expiring", expiringRes.error);
    return fail(500, "Falha ao consultar serviços a expirar.");
  }
  if (expiredRes.error) {
    serverLogError("service:email-expiry.expired", expiredRes.error);
    return fail(500, "Falha ao consultar serviços expirados.");
  }

  let notified = 0;
  let suspended = 0;

  for (const s of (expiringRes.data ?? []) as unknown as ExpiryRow[]) {
    if (!s.expires_at) continue;
    const daysLeft = Math.max(0, Math.ceil((new Date(s.expires_at).getTime() - now.getTime()) / DAYS_MS));
    if (daysLeft <= 0) continue;

    const meta = (s.meta ?? {}) as Record<string, unknown>;
    const sentStage = stringMeta(meta, "expiryStageSent");
    // Tightest window the deadline has entered (30 → 15 → 7 → 1), so each
    // stage fires once as the service ages towards expiry.
    const current = [...EXPIRY_STAGES].reverse().find((st) => st.days >= daysLeft);
    if (!current || sentStage === current.stage) continue;

    const email = s.customer_id ? await resolveUserEmail(s.customer_id) : undefined;
    const recipients = s.customer_id ? [{ userId: s.customer_id, email }] : [];
    const result = await notifyEvent(
      current.key as "email.expiring.30",
      {
        domain: s.domain,
        daysLeft,
        expiresAt: new Date(s.expires_at).toISOString().slice(0, 10),
      },
      { recipients },
    );
    notified += result.sent;

    await supabaseAdmin
      .from("email_services")
      .update({
        meta: { ...meta, expiryStageSent: current.stage, expiryStageSentAt: nowIso },
        updated_at: nowIso,
      })
      .eq("id", s.id);
  }

  for (const s of (expiredRes.data ?? []) as unknown as ExpiryRow[]) {
    const meta = (s.meta ?? {}) as Record<string, unknown>;
    const selection = selectEmailProvider();
    let result: { ok: boolean; message?: string };
    try {
      result = await selection.provider.suspend({
        emailServiceId: s.id,
        domain: s.domain,
        reason: "Prazo do serviço expirado",
      });
    } catch (e) {
      serverLogError(`service:email-expiry.suspend:${s.id}`, e);
      continue;
    }
    if (!result.ok) {
      serverLogError("service:email-expiry.suspend", new Error(result.message ?? "provider failure"));
      continue;
    }

    await supabaseAdmin
      .from("email_services")
      .update({
        status: "suspended",
        provider_status: "suspended",
        meta: { ...meta, expirySuspendedAt: nowIso, expirySuspendedReason: "expired" },
        updated_at: nowIso,
      })
      .eq("id", s.id);
    suspended += 1;

    const email = s.customer_id ? await resolveUserEmail(s.customer_id) : undefined;
    await notifyEvent(
      "email.expired",
      { domain: s.domain, expiresAt: s.expires_at ? new Date(s.expires_at).toISOString().slice(0, 10) : null },
      { recipients: s.customer_id ? [{ userId: s.customer_id, email }] : [] },
    );

    await logAudit({
      action: AUDIT.EMAIL_SERVICE_SUSPENDED,
      entity: "email_service",
      entityId: s.id,
      actorRole: "system",
      meta: { reason: "expired", source: "cron" },
    });
  }

  return {
    ok: true,
    checked: (expiringRes.data ?? []).length + (expiredRes.data ?? []).length,
    notified,
    suspended,
  };
}

function stringMeta(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v ? v : null;
}