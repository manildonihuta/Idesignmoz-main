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
}