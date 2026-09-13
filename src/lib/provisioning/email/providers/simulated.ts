import "server-only";

import type {
  EmailProvider,
  EmailProviderResult,
  EmailProvisionRequest,
  EmailProvisionResponse,
  MailboxProvisionRequest,
  MailboxProviderResult,
  MailboxRef,
  EmailServiceAction,
} from "../types";

/**
 * Simulated email backend — the default. Exposes the full lifecycle so the
 * whole purchase → provision → active flow works end-to-end in development
 * and staging without any external credentials (same pattern as the simulated
 * hosting / registrar adapters).
 */
const simulatedMailboxes = new Map<string, "active" | "suspended">();

/** Testing hook: forget every simulated mailbox (and service) state. */
export function __resetSimulatedEmail(): void {
  simulatedMailboxes.clear();
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
    return { ok: true, message: `Caixa ${ref.emailAddress} removida.` };
  },
};