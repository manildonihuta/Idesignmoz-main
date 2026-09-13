import "server-only";

import type {
  EmailProvider,
  EmailProviderResult,
  EmailProvisionRequest,
  EmailProvisionResponse,
  EmailServiceAction,
} from "../types";

/**
 * cPanel/WHM email backend.
 *
 * In the WHM model an "email service" maps to the cPanel account that hosts
 * the domain, so createService VALIDATES that the domain is hosted on the
 * WHM server (rather than creating a hosting account). Mailbox management
 * (Email::add_pop / list_pops / suspend_* via cPanel UAPI over WHM API tokens)
 * is planned for the mailbox-management slice.
 *
 * Requires WHM_HOST + WHM_API_TOKEN (and optionally WHM_USER).
 */
export const whmEmailProvider: EmailProvider = {
  id: "email-whm",
  label: "WHM / cPanel Email",
  get configured() {
    return Boolean(process.env.WHM_HOST && process.env.WHM_API_TOKEN);
  },
  // Mailbox APIs arrive in the mailbox slice; more capabilities are added
  // as genuine implementations land (never advertised before they exist).
  capabilities: [] as const,

  async createService(req: EmailProvisionRequest): Promise<EmailProvisionResponse> {
    const host = process.env.WHM_HOST;
    const token = process.env.WHM_API_TOKEN;
    const user = process.env.WHM_USER ?? "root";
    if (!host || !token) {
      throw new Error("WHM não está configurado (WHM_HOST / WHM_API_TOKEN).");
    }

    const params = new URLSearchParams({
      search: req.domain,
      searchtype: "domain",
    });
    const url = `https://${host}:2087/json-api/listaccts?${params.toString()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `whm ${user}:${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`WHM listaccts falhou (HTTP ${res.status}).`);
    }
    const payload = (await res.json()) as {
      acct?: { domain?: string }[];
    };

    const hosted = (payload.acct ?? []).some((a) => String(a.domain ?? "").toLowerCase() === req.domain);
    if (!hosted) {
      throw new Error(
        `O domínio ${req.domain} não está alojado neste servidor WHM. Aloja o domínio primeiro ou escolhe outro backend de email.`,
      );
    }

    return {
      providerId: this.id,
      providerLabel: this.label,
      providerEmailId: `whm:${req.domain}`,
      mode: "live",
      createdAt: new Date().toISOString(),
      meta: { whmHost: host, domain: req.domain },
    };
  },

  async suspend(action: EmailServiceAction): Promise<EmailProviderResult> {
    // cPanel email suspension is account-scoped; the hosting slice owns
    // suspendacct. Mailbox-level suspension ships with the mailbox slice.
    return { ok: true, message: `Suspensão de email WHM de ${action.domain} será aplicada ao gerir caixas.` };
  },

  async reactivate(action: EmailServiceAction): Promise<EmailProviderResult> {
    return { ok: true, message: `Reativação de email WHM de ${action.domain} será aplicada ao gerir caixas.` };
  },

  async deleteService(action: EmailServiceAction): Promise<EmailProviderResult> {
    return { ok: true, message: `Remoção de email WHM de ${action.domain} será aplicada ao gerir caixas.` };
  },
};