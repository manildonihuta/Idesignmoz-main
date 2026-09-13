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

/** Payload for creating an address alias (a forwarder in cPanel terms). */
export type AliasProvisionRequest = {
  aliasAddress: string; // local@domain (the alias)
  domain: string;
  destination: string; // where the alias delivers to (mailbox or external)
};

export type AliasProviderResult = EmailProviderResult & {
  providerAliasId?: string;
  meta?: Record<string, unknown>;
};

/** Identifies an existing alias at the provider. */
export type AliasRef = {
  aliasAddress: string;
  domain: string;
  destination: string;
  serviceProviderEmailId: string;
  providerMeta?: Record<string, unknown>;
};

/** Autoresponder configuration for a mailbox. Null disables it. */
export type AutoresponderConfig = {
  subject: string;
  body: string;
  fromName?: string;
  fromDate?: string;
  toDate?: string;
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

  /** Aliases / forwarders (requires the `aliases` capability). */
  createAlias(req: AliasProvisionRequest): Promise<AliasProviderResult>;
  deleteAlias(ref: AliasRef): Promise<EmailProviderResult>;

  /**
   * Replaces mailbox forwarding destinations (requires `forwarding`).
   * Pass an empty array to clear all forwarders of the mailbox.
   */
  setForwarding(ref: MailboxRef, forwardTo: string[]): Promise<EmailProviderResult>;

  /**
   * Configures the autoresponder (requires `autoresponder`).
   * Null disables it.
   */
  setAutoresponder(ref: MailboxRef, config: AutoresponderConfig | null): Promise<EmailProviderResult>;
}