/**
 * Email service provisioning — provider abstraction + capabilities.
 * Mirrors the hosting/domain provisioning modules: the customer dashboard and
 * provisioning engine only talk to an EmailProvider, never to external APIs.
 */

export type EmailCapability =
  | "mailboxes"
  | "aliases"
  | "forwarding"
  | "autoresponder"
  | "webmail"
  | "dkim"
  | "dmarc"
  | "storage_limits"
  | "archiving"
  | "security";

export type EmailProvisionRequest = {
  domain: string;
  planName: string;
  mailboxLimit: number;
  storageLimitGb: number;
};

export type EmailProvisionResponse = {
  providerId: string;
  providerLabel: string;
  providerEmailId: string;
  mode: "simulated" | "live";
  createdAt: string;
  meta?: Record<string, unknown>;
};

export type EmailServiceAction = {
  emailServiceId: string;
  domain: string;
  reason?: string;
};

export type EmailProviderResult = { ok: boolean; message?: string };

/** Payload for creating a mailbox. Password is TRANSIENT — never persisted. */
export type MailboxProvisionRequest = {
  localPart: string;
  domain: string;
  emailAddress: string; // localPart@domain
  displayName?: string;
  password: string;
  quotaGb: number;
};

/** Identifies an existing mailbox at the provider (provider-side ids). */
export type MailboxRef = {
  emailAddress: string;
  domain: string;
  serviceProviderEmailId: string;
  providerMeta?: Record<string, unknown>; // e.g. WHM host + cPanel user
};

export type MailboxProviderResult = EmailProviderResult & {
  providerMailboxId?: string;
  meta?: Record<string, unknown>;
};

/**
 * A concrete email backend. Capabilities declare what the provider can REALLY
 * do — unsupported features are never advertised and stay hidden from the UI.
 */
export interface EmailProvider {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;
  readonly capabilities: readonly EmailCapability[];

  /**
   * Creates the email service for a domain at the provider. May validate
   * (e.g. a WHM-backed domain) instead of physically creating when the
   * provider model maps 1:1 to an existing account.
   */
  createService(req: EmailProvisionRequest): Promise<EmailProvisionResponse>;

  suspend(action: EmailServiceAction): Promise<EmailProviderResult>;
  reactivate(action: EmailServiceAction): Promise<EmailProviderResult>;
  deleteService(action: EmailServiceAction): Promise<EmailProviderResult>;

  /** Mailbox management (requires the `mailboxes` capability). */
  createMailbox(req: MailboxProvisionRequest): Promise<MailboxProviderResult>;
  suspendMailbox(ref: MailboxRef): Promise<EmailProviderResult>;
  reactivateMailbox(ref: MailboxRef): Promise<EmailProviderResult>;
  deleteMailbox(ref: MailboxRef): Promise<EmailProviderResult>;
}