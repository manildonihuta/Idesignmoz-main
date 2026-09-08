import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AuditMeta = Record<string, unknown>;

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  ip?: string;
  meta?: AuditMeta;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      actor_role: entry.actorRole ?? null,
      ip: entry.ip ?? null,
      meta: entry.meta ?? null,
    });
  } catch {
    // audit logging must never break business logic
  }
}

export const AUDIT = {
  CONTACT_CREATED: "contact.created",
  DOMAIN_ORDER_CREATED: "domain_order.created",
  DOMAIN_REGISTERED: "domain.registered",
  DOMAIN_RECHECKED: "domain.rechecked",
  DOMAIN_DELETED: "domain.deleted",
  MESSAGE_STATUS: "message.status",
  MESSAGE_DELETED: "message.deleted",
  ORDER_STATUS: "order.status",
  ORDER_DELETED: "order.deleted",
  PROFILE_ROLE: "profile.role",
  PROPOSAL_CREATED: "proposal.created",
  PROPOSAL_UPDATED: "proposal.updated",
  PROPOSAL_DELETED: "proposal.deleted",
  PROPOSAL_CLIENT_DECISION: "proposal.client_decision",
  CLIENT_DOMAIN_UPDATED: "client_domain.updated",
  PROVISIONING_DOMAIN: "provisioning.domain",
  PROVISIONING_HOSTING: "provisioning.hosting",
  DOMAIN_EXPIRY_REMINDER: "domain.expiry_reminder",
  DOMAIN_AUTO_RENEW: "domain.auto_renew",
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_PAST_DUE: "subscription.past_due",
  SUBSCRIPTION_SUSPENDED: "subscription.suspended",
  SUBSCRIPTION_TERMINATED: "subscription.terminated",
  PROJECT_BRIEF: "project.brief",
  PROJECT_ACTIVATED: "project.activated",
  AI_SITE_GENERATED: "ai_site.generated",
  AI_SITE_GENERATION_FAILED: "ai_site.generation_failed",
  AI_SITE_PUBLISHED: "ai_site.published",
} as const;