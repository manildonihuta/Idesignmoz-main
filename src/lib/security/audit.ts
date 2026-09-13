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
  DNS_ZONE_CREATED: "dns.zone_created",
  DNS_ZONE_DELETED: "dns.zone_deleted",
  DNS_ZONE_SYNCED: "dns.zone_synced",
  DNS_RECORD_CREATED: "dns.record_created",
  DNS_RECORD_UPDATED: "dns.record_updated",
  DNS_RECORD_DELETED: "dns.record_deleted",
  DNS_NAMESERVERS_UPDATED: "dns.nameservers_updated",
  DNS_DNSSEC: "dns.dnssec",
  SETTINGS_UPDATED: "settings.updated",
  HOSTING_STATUS: "hosting.status",
  HOSTING_PLAN: "hosting.plan",
  HOSTING_SYNC: "hosting.sync",
  HOSTING_WEBSITE_CREATED: "hosting.website.created",
  HOSTING_WEBSITE_UPDATED: "hosting.website.updated",
  HOSTING_WEBSITE_DELETED: "hosting.website.deleted",
  HOSTING_DATABASE_CREATED: "hosting.database.created",
  HOSTING_DATABASE_DELETED: "hosting.database.deleted",
  HOSTING_DATABASE_PASSWORD_RESET: "hosting.database.password_reset",
  HOSTING_BACKUP_CREATED: "hosting.backup.created",
  HOSTING_BACKUP_RESTORED: "hosting.backup.restored",
  HOSTING_BACKUP_DELETED: "hosting.backup.deleted",
  HOSTING_SSL_INSTALLED: "hosting.ssl.installed",
  HOSTING_SSL_RENEWED: "hosting.ssl.renewed",
  HOSTING_SSL_REMOVED: "hosting.ssl.removed",
  HOSTING_PHP_CHANGED: "hosting.php.changed",
  HOSTING_CRON_CREATED: "hosting.cron.created",
  HOSTING_CRON_UPDATED: "hosting.cron.updated",
  HOSTING_CRON_DELETED: "hosting.cron.deleted",
  HOSTING_ALERT_ACKED: "hosting.alert.acked",
  INFRA_PROVIDER_SAVED: "infra.provider.saved",
  INFRA_PROVIDER_STATUS: "infra.provider.status",
  INFRA_CONNECTION_TESTED: "infra.connection.tested",
  INFRA_CREDENTIAL_ADDED: "infra.credential.added",
  INFRA_CREDENTIAL_TESTED: "infra.credential.tested",
  INFRA_CREDENTIAL_ROTATED: "infra.credential.rotated",
  INFRA_CREDENTIAL_REVOKED: "infra.credential.revoked",
  INFRA_SYNC_RUN: "infra.sync.run",
  INFRA_WEBHOOK_SAVED: "infra.webhook.saved",
  INFRA_WEBHOOK_DELETED: "infra.webhook.deleted",
  INFRA_WEBHOOK_TESTED: "infra.webhook.tested",
  PAYMENT_VERIFIED: "payment.verified",
  PAYMENT_REJECTED: "payment.rejected",
  PAYMENT_PROOF_UPLOADED: "payment.proof_uploaded",
  REFUND_REQUESTED: "refund.requested",
  REFUND_APPROVED: "refund.approved",
  REFUND_REJECTED: "refund.rejected",
  CREDIT_ISSUED: "credit.issued",
  EMAIL_SERVICE_CREATED: "email.service.created",
  EMAIL_PROVISIONING_COMPLETED: "email.provisioning.completed",
  EMAIL_PROVISIONING_FAILED: "email.provisioning.failed",
  EMAIL_MAILBOX_CREATED: "email.mailbox.created",
  EMAIL_MAILBOX_SUSPENDED: "email.mailbox.suspended",
  EMAIL_MAILBOX_REACTIVATED: "email.mailbox.reactivated",
  EMAIL_MAILBOX_DELETED: "email.mailbox.deleted",
  EMAIL_ALIAS_CREATED: "email.alias.created",
  EMAIL_ALIAS_DELETED: "email.alias.deleted",
  EMAIL_FORWARDING_UPDATED: "email.forwarding.updated",
  EMAIL_AUTORESPONDER_UPDATED: "email.autoresponder.updated",
  EMAIL_DNS_VERIFIED: "email.dns.verified",
  EMAIL_MAILBOX_PASSWORD_RESET: "email.mailbox.password_reset",
  EMAIL_USAGE_SYNCED: "email.usage.synced",
  EMAIL_SERVICE_SUSPENDED: "email.service.suspended",
  EMAIL_SERVICE_REACTIVATED: "email.service.reactivated",
  EMAIL_SERVICE_RENEWED: "email.service.renewed",
} as const;