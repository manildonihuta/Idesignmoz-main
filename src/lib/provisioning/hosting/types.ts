import type { EncryptedSecret } from "../credentials";

export type HostingPanel = "cpanel" | "plesk" | "cloud-vps" | "custom";

export type HostingPlanLimits = {
  diskGb: number;
  bandwidthGb: number;
  websites: number;
  emailAccounts: number;
  databases: number;
  cpu: string;
  ramMb: number;
};

export type HostingProvisionRequest = {
  orderId: string;
  customerName: string;
  customerEmail: string;
  domain: string;
  planName: string;
  planLimits: HostingPlanLimits;
  username?: string;
};

export type HostingProvisionResponse = {
  providerId: string;
  providerLabel: string;
  accountId: string;
  panelUrl?: string;
  username: string;
  nameservers: string[];
  serverIp?: string;
  planName: string;
  createdAt: string;
  generatedPassword: string;
  encryptedPassword: EncryptedSecret;
};

export type HostingProviderAction = {
  providerId: string;
  accountId: string;
  domain: string;
  reason?: string;
};

export type HostingProviderResult = { ok: boolean; message?: string };

/**
 * Control-panel features a provider actually supports. The customer dashboard
 * renders a section / action only when its capability is present — unsupported
 * features are shown as "não incluído" states, never as fake actions.
 */
export type HostingCapability =
  | "accounts"
  | "usage"
  | "websites"
  | "databases"
  | "backups"
  | "ssl"
  | "php"
  | "cron"
  | "ssh"
  | "email"
  | "files"
  | "performance"
  | "security"
  | "staging"
  | "alerts";

export type ProviderCapabilities = readonly HostingCapability[];

export interface HostingProvider {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;

  /** Which control-panel features this provider genuinely supports. */
  readonly capabilities: ProviderCapabilities;

  provision(req: HostingProvisionRequest): Promise<HostingProvisionResponse>;
  suspend(action: HostingProviderAction): Promise<HostingProviderResult>;
  unsuspend(action: HostingProviderAction): Promise<HostingProviderResult>;
  terminate(action: HostingProviderAction): Promise<HostingProviderResult>;
}