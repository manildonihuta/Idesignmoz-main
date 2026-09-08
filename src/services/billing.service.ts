import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSiteSettings } from "@/lib/site-settings";
import { notifyEvent } from "@/lib/notifications";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";
import {
  CYCLE_LABELS,
  CYCLE_MONTHS,
  isBillingCycle,
  sellPeriodToCycle,
  type BillingCycle,
  type ClientSubscription,
} from "@/lib/billing";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceResult } from "./result";

export type { BillingCycle, ClientSubscription } from "@/lib/billing";
export { BILLING_CYCLES, CYCLE_LABELS, CYCLE_MONTHS, isBillingCycle } from "@/lib/billing";

/**
 * Hosting subscription lifecycle:
 *   active -> past_due -> suspended -> terminated
 * A cycle that reaches `renews_at` and cannot be renewed enters past_due;
 * staff may extend grace via the site hosting settings (`billingGraceDays`),
 * after which the subscription is suspended, and finally terminated.
 */

export const GRACE_DEFAULT_DAYS = 7;
export const TERMINATION_DEFAULT_DAYS = 30;

export type SubscriptionRow = {
  id: string;
  customer_id: string | null;
  organization_id: string | null;
  kind: string;
  plan_id: string | null;
  period: string;
  price: number;
  currency: string;
  status: string;
  starts_at: string;
  renews_at: string | null;
  auto_renew: boolean;
  payment_method: string | null;
  past_due_since: string | null;
  suspended_since: string | null;
  created_at: string;
  updated_at: string;
};

export function nextRenewal(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + CYCLE_MONTHS[cycle]);
  return d;
}

/* --------------------------------------------------------------------- *
 * Create a subscription (hosting/service) from a paid item with a billing
 * cycle. Prices come from the order (itself DB-backed); the cycle maps the
 * catalog sell period (monthly/quarterly/semiannual/annual) to the stored
 * period (month/quarter/semiannual/year).
 * --------------------------------------------------------------------- */

export type CreateSubscriptionInput = {
  customerId?: string | null;
  organizationId?: string | null;
  kind: "hosting" | "service" | "package";
  period: string;                 // sell period or stored cycle
  price: number;
  currency: string;
  autoRenew?: boolean;
  paymentMethod?: string | null;
  planId?: string | null;
  startsAt?: Date;
};

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<ServiceResult<{ subscription: SubscriptionRow }>> {
  const cycle = sellPeriodToCycle(input.period) ?? (isBillingCycle(input.period) ? input.period : null);
  if (!cycle) {
    return fail(400, "Período de facturação inválido.");
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return fail(400, "Preço inválido.");
  }

  const now = input.startsAt ?? new Date();
  const renewsAt = nextRenewal(now, cycle);

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      customer_id: input.customerId ?? null,
      organization_id: input.organizationId ?? null,
      kind: input.kind,
      plan_id: input.planId ?? null,
      period: cycle,
      price: input.price,
      currency: input.currency || "MZN",
      status: "active",
      starts_at: now.toISOString(),
      renews_at: renewsAt.toISOString(),
      auto_renew: input.autoRenew ?? true,
      payment_method: input.paymentMethod ?? null,
    })
    .select()
    .single();

  if (error) {
    serverLogError("service:billing.createSubscription", error);
    return fail(500, "Não foi possível criar a subscrição.");
  }

  await logAudit({
    action: AUDIT.SUBSCRIPTION_CREATED,
    entity: "subscription",
    entityId: data.id,
    actorId: input.customerId ?? undefined,
    meta: {
      kind: input.kind,
      period: cycle,
      price: input.price,
      currency: input.currency,
      renewsAt: renewsAt.toISOString(),
    },
  });

  await notifyEvent("subscription.created", {
    kind: input.kind,
    period: CYCLE_LABELS[cycle],
    price: input.price,
  });

  return { ok: true, subscription: data as SubscriptionRow };
}

/* --------------------------------------------------------------------- *
 * Lifecycle cron — walks every open hosting/service subscription whose
 * renewal date has passed and advances the state machine:
 *   active   -> past_due        (cycle ended, no renewed payment)
 *   past_due -> suspended       (grace elapsed)
 *   suspended-> terminated      (retention elapsed)
 * Durations come from the DB site settings (hosting section).
 * --------------------------------------------------------------------- */

export async function advanceBillingLifecycle(): Promise<
  ServiceResult<{
    checked: number;
    pastDue: number;
    suspended: number;
    terminated: number;
  }>
> {
  const settings = await getSiteSettings();
  const graceDays = settings.hosting.billingGraceDays ?? GRACE_DEFAULT_DAYS;
  const terminationDays = settings.hosting.billingTerminationDays ?? TERMINATION_DEFAULT_DAYS;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const { data: subs, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "past_due", "suspended"])
    .not("renews_at", "is", null)
    .lte("renews_at", new Date(now).toISOString());

  if (error) {
    serverLogError("service:billing.advanceLifecycle", error);
    return fail(500, "Falha ao consultar subscrições.");
  }

  let pastDue = 0;
  let suspended = 0;
  let terminated = 0;

  for (const sub of subs ?? []) {
    // Edge: skip rows where renews_at is in the past but the status change
    // is not yet due (e.g. a strong future grace). Handled by the checks.
    if (sub.status === "active") {
      const { error: upErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ status: "past_due", past_due_since: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("id", sub.id);
      if (upErr) {
        serverLogError("service:billing.advanceLifecycle.active", upErr);
        continue;
      }
      pastDue += 1;
      await logAudit({
        action: AUDIT.SUBSCRIPTION_PAST_DUE,
        entity: "subscription",
        entityId: (sub as { id: string }).id,
        meta: { period: (sub as { period?: string }).period },
      });
      await notifyEvent("subscription.past_due", {
        kind: (sub as { kind?: string }).kind,
        period: CYCLE_LABELS[(sub as { period?: string }).period as BillingCycle] ?? "",
      });
      continue;
    }

    if (sub.status === "past_due") {
      const pastDueSince = sub.past_due_since ? new Date(sub.past_due_since).getTime() : null;
      if (pastDueSince == null || now - pastDueSince < graceDays * dayMs) continue;
      const { error: upErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ status: "suspended", suspended_since: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("id", sub.id);
      if (upErr) {
        serverLogError("service:billing.advanceLifecycle.pastDue", upErr);
        continue;
      }
      suspended += 1;
      await syncHostingAccount((sub as { customer_id?: string | null }).customer_id, "suspended");
      await logAudit({
        action: AUDIT.SUBSCRIPTION_SUSPENDED,
        entity: "subscription",
        entityId: (sub as { id: string }).id,
        meta: { period: (sub as { period?: string }).period },
      });
      await notifyEvent("subscription.suspended", {});
      continue;
    }

    if (sub.status === "suspended") {
      const suspendedSince = sub.suspended_since ? new Date(sub.suspended_since).getTime() : null;
      if (suspendedSince == null || now - suspendedSince < terminationDays * dayMs) continue;
      const { error: upErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ status: "terminated", updated_at: new Date(now).toISOString() })
        .eq("id", sub.id);
      if (upErr) {
        serverLogError("service:billing.advanceLifecycle.suspended", upErr);
        continue;
      }
      terminated += 1;
      await syncHostingAccount((sub as { customer_id?: string | null }).customer_id, "terminated");
      await logAudit({
        action: AUDIT.SUBSCRIPTION_TERMINATED,
        entity: "subscription",
        entityId: (sub as { id: string }).id,
        meta: { period: (sub as { period?: string }).period },
      });
      await notifyEvent("subscription.terminated", {});
    }
  }

  return { ok: true, checked: (subs ?? []).length, pastDue, suspended, terminated };
}

/** Mirror a subscription lifecycle state onto the customer's hosting account. */
async function syncHostingAccount(customerId: string | null | undefined, status: "suspended" | "terminated"): Promise<void> {
  if (!customerId) return;
  const { error } = await supabaseAdmin
    .from("hosting_accounts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .in("status", ["active", "suspended"]);
  if (error) {
    serverLogError("service:billing.syncHostingAccount", error);
  }
}

/* --------------------------------------------------------------------- *
 * Client: list own subscriptions (billing state incl. lifecycle status)
 * --------------------------------------------------------------------- */

export async function listClientSubscriptions(ctx: AuthContext): Promise<ClientSubscription[]> {
  if (!ctx.userId) return [];

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("customer_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((s) => ({
    id: s.id,
    kind: s.kind,
    period: s.period,
    price: Number(s.price ?? 0),
    currency: s.currency ?? "MZN",
    status: s.status,
    startsAt: s.starts_at,
    renewsAt: s.renews_at,
    autoRenew: s.auto_renew ?? true,
    paymentMethod: s.payment_method,
    pastDueSince: s.past_due_since,
    suspendedSince: s.suspended_since,
    createdAt: s.created_at,
  }));
}