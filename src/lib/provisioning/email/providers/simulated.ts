import "server-only";

import type {
  AliasProvisionRequest,
  AliasProviderResult,
  AliasRef,
  AutoresponderConfig,
  EmailProvider,
  EmailProviderResult,
  EmailProvisionRequest,
  EmailProvisionResponse,
  MailboxPasswordResult,
  MailboxProvisionRequest,
  MailboxProviderResult,
  MailboxRef,
  MailboxUsageRequest,
  MailboxUsageResult,
  EmailServiceAction,
} from "../types";

/**
 * Simulated email backend — the default. Exposes the full lifecycle so the
 * whole purchase → provision → active → mailbox management flow works
 * end-to-end in development and staging without any external credentials
 * (same pattern as the simulated hosting / registrar adapters).
 */
const simulatedMailboxes = new Map<string, "active" | "suspended">();
const simulatedAliases = new Map<string, string>();
const simulatedForwarders = new Map<string, string[]>();
const simulatedAutoresponders = new Map<string, AutoresponderConfig>();
const simulatedQuotaGb = new Map<string, number>();
const simulatedStorageUsedGb = new Map<string, number>();
const simulatedPasswordChangedAt = new Map<string, string>();

/** Testing hook: forget every simulated email state. */
export function __resetSimulatedEmail(): void {
  simulatedMailboxes.clear();
  simulatedAliases.clear();
  simulatedForwarders.clear();
  simulatedAutoresponders.clear();
  simulatedQuotaGb.clear();
  simulatedStorageUsedGb.clear();
  simulatedPasswordChangedAt.clear();
}

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic, bounded "used storage" for a simulated mailbox. */
function simulatedUsedGb(emailAddress: string, quotaGb: number): number {
  const existing = simulatedStorageUsedGb.get(emailAddress);
  if (existing !== undefined) return existing;
  const fraction = (stableHash(`usage:${emailAddress}`) % 100) / 100;
  const value = Math.round(fraction * Math.max(0, quotaGb) * 100) / 100;
  simulatedStorageUsedGb.set(emailAddress, value);
  return value;
}

export const simulatedEmailProvider: EmailProvider = {
  id: "email-simulated",
  label: "Email Simulado",
  configured: true,
  capabilities: [
    "mailboxes",
    "aliases",
    "forwarding",
    "autoresponder",
    "webmail",
    "dkim",
    "dmarc",
    "storage_limits",
    "archiving",
    "security",
  ] as const,

  async createService(req: EmailProvisionRequest): Promise<EmailProvisionResponse> {
    return {
      providerId: this.id,
      providerLabel: this.label,
      providerEmailId: `sim:${req.domain}`,
      mode: "simulated",
      createdAt: new Date().toISOString(),
      meta: {
        simulation: true,
        mailboxLimit: req.mailboxLimit,
        storageLimitGb: req.storageLimitGb,
      },
    };
  },

  async suspend(action: EmailServiceAction): Promise<EmailProviderResult> {
    return { ok: true, message: `Serviço de email simulado de ${action.domain} suspenso.` };
  },

  async reactivate(action: EmailServiceAction): Promise<EmailProviderResult> {
    return { ok: true, message: `Serviço de email simulado de ${action.domain} reativado.` };
  },

  async deleteService(action: EmailServiceAction): Promise<EmailProviderResult> {
    return { ok: true, message: `Serviço de email simulado de ${action.domain} removido.` };
  },

  async createMailbox(req: MailboxProvisionRequest): Promise<MailboxProviderResult> {
    const providerMailboxId = `sim:${req.emailAddress}`;
    simulatedMailboxes.set(providerMailboxId, "active");
    simulatedQuotaGb.set(providerMailboxId, req.quotaGb);
    simulatedPasswordChangedAt.set(req.emailAddress, new Date().toISOString());
    return {
      ok: true,
      providerMailboxId,
      meta: {
        simulation: true,
        quotaGb: req.quotaGb,
        passwordEncrypted: "simulated-noop",
      },
    };
  },

  async suspendMailbox(ref: MailboxRef): Promise<EmailProviderResult> {
    simulatedMailboxes.set(`sim:${ref.emailAddress}`, "suspended");
    return { ok: true, message: `Caixa ${ref.emailAddress} suspensa.` };
  },

  async reactivateMailbox(ref: MailboxRef): Promise<EmailProviderResult> {
    simulatedMailboxes.set(`sim:${ref.emailAddress}`, "active");
    return { ok: true, message: `Caixa ${ref.emailAddress} reativada.` };
  },

  async deleteMailbox(ref: MailboxRef): Promise<EmailProviderResult> {
    simulatedMailboxes.delete(`sim:${ref.emailAddress}`);
    simulatedForwarders.delete(ref.emailAddress);
    simulatedAutoresponders.delete(ref.emailAddress);
    simulatedStorageUsedGb.delete(ref.emailAddress);
    simulatedPasswordChangedAt.delete(ref.emailAddress);
    return { ok: true, message: `Caixa ${ref.emailAddress} removida.` };
  },

  async createAlias(req: AliasProvisionRequest): Promise<AliasProviderResult> {
    const providerAliasId = `sim:${req.aliasAddress}`;
    simulatedAliases.set(req.aliasAddress, req.destination);
    return { ok: true, providerAliasId, meta: { simulation: true } };
  },

  async deleteAlias(ref: AliasRef): Promise<EmailProviderResult> {
    simulatedAliases.delete(ref.aliasAddress);
    return { ok: true, message: `Alias ${ref.aliasAddress} removido.` };
  },

  async setForwarding(ref: MailboxRef, forwardTo: string[]): Promise<EmailProviderResult> {
    simulatedForwarders.set(ref.emailAddress, [...forwardTo]);
    return { ok: true, message: "Reencaminhamento atualizado." };
  },

  async setAutoresponder(
    ref: MailboxRef,
    config: AutoresponderConfig | null,
  ): Promise<EmailProviderResult> {
    if (config) {
      simulatedAutoresponders.set(ref.emailAddress, config);
    } else {
      simulatedAutoresponders.delete(ref.emailAddress);
    }
    return { ok: true, message: config ? "Respondedor automático ativado." : "Respondedor automático desativado." };
  },

  async setPassword(ref: MailboxRef, _password: string): Promise<MailboxPasswordResult> {
    const now = new Date().toISOString();
    simulatedPasswordChangedAt.set(ref.emailAddress, now);
    return {
      ok: true,
      message: `Password da caixa ${ref.emailAddress} redefinida.`,
      meta: { simulation: true, passwordChangedAt: now, passwordLength: _password.length, passwordEncrypted: "simulated-noop" },
    };
  },

  async refreshMailboxUsage(req: MailboxUsageRequest): Promise<MailboxUsageResult> {
    const mailboxes = req.mailboxes.map((m) => {
      const key = `sim:${m.emailAddress}`;
      const quotaGb = simulatedQuotaGb.get(key) ?? 0;
      return { emailAddress: m.emailAddress, storageUsedGb: simulatedUsedGb(m.emailAddress, quotaGb) };
    });
    return {
      ok: true,
      mailboxes,
      message: `Estatísticas de ${mailboxes.length} caixa(s) atualizadas.`,
    };
  },
};