import "server-only";

import type {
  EmailProvider,
  EmailProviderResult,
  EmailProvisionRequest,
  EmailProvisionResponse,
  EmailServiceAction,
  MailboxProvisionRequest,
  MailboxProviderResult,
  MailboxRef,
} from "../types";

/** Host + API token used for both WHM json-api and cPanel UAPI calls. */
function whmCreds(): { host?: string; token?: string; user: string } {
  return {
    host: process.env.WHM_HOST,
    token: process.env.WHM_API_TOKEN,
    user: process.env.WHM_USER ?? "root",
  };
}

/**
 * cPanel/WHM email backend.
 *
 * In the WHM model an "email service" maps to the cPanel account that hosts
 * the domain, so createService VALIDATES that the domain is hosted on the
 * WHM server (rather than creating a hosting account) and returns the cPanel
 * account username (stored in service meta) so mailbox UAPI calls can target
 * that account: Email::add_pop / delete_pop / suspend_login / unsuspend_login
 * with an API token (Server Configuration → Assign a token to cPanel).
 *
 * Requires WHM_HOST + WHM_API_TOKEN (and optionally WHM_USER).
 */
export const whmEmailProvider: EmailProvider = {
  id: "email-whm",
  label: "WHM / cPanel Email",
  get configured() {
    return Boolean(process.env.WHM_HOST && process.env.WHM_API_TOKEN);
  },
  capabilities: ["mailboxes"] as const,

  async createService(req: EmailProvisionRequest): Promise<EmailProvisionResponse> {
    const creds = whmCreds();
    if (!creds.host || !creds.token) {
      throw new Error("WHM não está configurado (WHM_HOST / WHM_API_TOKEN).");
    }

    const params = new URLSearchParams({
      search: req.domain,
      searchtype: "domain",
    });
    const url = `https://${creds.host}:2087/json-api/listaccts?${params.toString()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `whm ${creds.user}:${creds.token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`WHM listaccts falhou (HTTP ${res.status}).`);
    }
    const payload = (await res.json()) as {
      acct?: { domain?: string; user?: string }[];
    };

    const acct = (payload.acct ?? []).find(
      (a) => String(a.domain ?? "").toLowerCase() === req.domain,
    );
    if (!acct) {
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
      meta: { whmHost: creds.host, domain: req.domain, cpanelUser: acct.user ?? "" },
    };
  },

  async suspend(action: EmailServiceAction): Promise<EmailProviderResult> {
    // Service-level suspension = account suspension; cPanel controls that via
    // the hosting slice (suspendacct). Not implemented here by design.
    return { ok: true, message: `Suspensão geral de ${action.domain} gerida via alojamento.` };
  },

  async reactivate(action: EmailServiceAction): Promise<EmailProviderResult> {
    return { ok: true, message: `Reativação geral de ${action.domain} gerida via alojamento.` };
  },

  async deleteService(action: EmailServiceAction): Promise<EmailProviderResult> {
    return { ok: true, message: `Remoção de ${action.domain} gerida via alojamento.` };
  },

  async createMailbox(req: MailboxProvisionRequest): Promise<MailboxProviderResult> {
    const result = await cpanelCall<{ result?: boolean; status?: number; errors?: unknown[] }>(
      "Email",
      "add_pop",
      {
        email: req.localPart,
        domain: req.domain,
        password: req.password,
        quota: String(Math.max(1, Math.round(req.quotaGb * 1024))), // MB
      },
    );
    if (!result.ok) return result;
    if (result.errors?.length) {
      return { ok: false, message: String(result.errors[0]) };
    }
    return {
      ok: true,
      providerMailboxId: req.emailAddress,
      meta: { cPanel: true, createdQuotaMb: String(Math.max(1, Math.round(req.quotaGb * 1024))) },
    };
  },

  async suspendMailbox(ref: MailboxRef): Promise<EmailProviderResult> {
    const [localPart, domain] = splitAddress(ref.emailAddress);
    const result = await cpanelCall<{ errors?: unknown[] }>("Email", "suspend_login", {
      email: localPart,
      domain,
    });
    if (!result.ok) return result;
    if (result.errors?.length) {
      return { ok: false, message: String(result.errors[0]) };
    }
    return { ok: true, message: `Caixa ${ref.emailAddress} suspensa.` };
  },

  async reactivateMailbox(ref: MailboxRef): Promise<EmailProviderResult> {
    const [localPart, domain] = splitAddress(ref.emailAddress);
    const result = await cpanelCall<{ errors?: unknown[] }>("Email", "unsuspend_login", {
      email: localPart,
      domain,
    });
    if (!result.ok) return result;
    if (result.errors?.length) {
      return { ok: false, message: String(result.errors[0]) };
    }
    return { ok: true, message: `Caixa ${ref.emailAddress} reativada.` };
  },

  async deleteMailbox(ref: MailboxRef): Promise<EmailProviderResult> {
    const [localPart, domain] = splitAddress(ref.emailAddress);
    const result = await cpanelCall<{ errors?: unknown[] }>("Email", "delete_pop", {
      email: localPart,
      domain,
    });
    if (!result.ok) return result;
    if (result.errors?.length) {
      return { ok: false, message: String(result.errors[0]) };
    }
    return { ok: true, message: `Caixa ${ref.emailAddress} removida.` };
  },
};

function splitAddress(email: string): [string, string] {
  const at = email.lastIndexOf("@");
  if (at <= 0) return [email, ""];
  return [email.slice(0, at), email.slice(at + 1)];
}

/**
 * cPanel UAPI v2 via the WHM API token (Authentication → API tokens).
 * The token must have been granted to the target cPanel account
 * ("Server Configuration → Assign a token to cPanel").
 */
async function cpanelCall<T extends Record<string, unknown>>(
  moduleName: string,
  func: string,
  params: Record<string, string>,
): Promise<({ ok: true } & T) | { ok: false; message: string; errors?: unknown[] }> {
  const creds = whmCreds();
  if (!creds.host || !creds.token) {
    return { ok: false, message: "WHM não está configurado (WHM_HOST / WHM_API_TOKEN)." };
  }
  const cpanelUser = params.cpanelUser ?? "";
  if (!cpanelUser) {
    return { ok: false, message: "Conta cPanel não associada ao serviço de email." };
  }

  const qs = new URLSearchParams({
    cpanel_jsonapi_user: cpanelUser,
    cpanel_jsonapi_apiversion: "2",
    cpanel_jsonapi_module: moduleName,
    cpanel_jsonapi_func: func,
  });
  for (const [k, v] of Object.entries(params)) {
    if (k !== "cpanelUser") qs.set(k, v);
  }

  const url = `https://${creds.host}:2087/json-api/cpanel?${qs.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `whm ${creds.user}:${creds.token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    return { ok: false, message: `cPanel ${moduleName}::${func} falhou (HTTP ${res.status}).` };
  }

  const data = (await res.json()) as {
    cpanelresult?: { errors?: unknown[]; func?: string; module?: string; data?: unknown[] };
  };
  const cr = data.cpanelresult;
  const errors = Array.isArray(cr?.errors) && cr.errors.length ? cr.errors : undefined;
  if (errors) {
    return { ok: false, message: String(errors[0]), errors };
  }
  if (cr?.module !== moduleName) {
    return { ok: false, message: `cPanel ${moduleName}::${func} devolveu um resultado inesperado.` };
  }
  return { ok: true, ...(cr && cr.errors ? { errors: cr.errors } : {}) } as { ok: true } & T;
}