import "server-only";

import { encryptSecret, randomStrongPassword } from "../../credentials";
import { DEFAULT_NAMESERVERS, deriveUsername } from "../helpers";
import type { HostingProvider, HostingProviderAction, HostingProviderResult, HostingProvisionRequest, HostingProvisionResponse } from "../types";

/**
 * cPanel/WHM provisioning via the WHM JSON API v1.
 * Requires WHM_HOST + WHM_API_TOKEN (and optionally WHM_USER).
 */
export const whmProvider: HostingProvider = {
  id: "whm",
  label: "WHM / cPanel",
  get configured() {
    return Boolean(process.env.WHM_HOST && process.env.WHM_API_TOKEN);
  },

  async provision(req: HostingProvisionRequest): Promise<HostingProvisionResponse> {
    const host = process.env.WHM_HOST!;
    const token = process.env.WHM_API_TOKEN!;
    const user = process.env.WHM_USER ?? "root";
    const username = deriveUsername(req.domain, req.username);
    const password = randomStrongPassword();

    const params = new URLSearchParams({
      username,
      domain: req.domain,
      plan: req.planName,
      quota: String(req.planLimits.diskGb),
      max_emailaccounts: String(req.planLimits.emailAccounts),
      maxsql: String(req.planLimits.databases),
      contactemail: req.customerEmail,
    });

    const url = `https://${host}:2087/json-api/createacct?${params.toString()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `whm ${user}:${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`WHM createacct falhou (HTTP ${res.status}).`);
    }
    const payload = (await res.json()) as {
      metadata?: { result?: number; reason?: string };
      data?: { ip?: string; account?: string };
    };
    if (payload.metadata?.result !== 1) {
      throw new Error(payload.metadata?.reason ?? "WHM createacct devolveu erro.");
    }

    return {
      providerId: "whm",
      providerLabel: "WHM / cPanel",
      accountId: payload.data?.account ?? username,
      panelUrl: `https://${host}:2083`,
      username,
      nameservers: DEFAULT_NAMESERVERS,
      serverIp: payload.data?.ip,
      planName: req.planName,
      createdAt: new Date().toISOString(),
      generatedPassword: password,
      encryptedPassword: encryptSecret(password),
    };
  },

  async suspend(action: HostingProviderAction): Promise<HostingProviderResult> {
    await setAccountState(action.domain, action.reason ?? "suspensão administrativa", "suspendacct");
    return { ok: true };
  },

  async unsuspend(action: HostingProviderAction): Promise<HostingProviderResult> {
    await setAccountState(action.domain, action.reason ?? "reativação", "unsuspendacct");
    return { ok: true };
  },

  async terminate(action: HostingProviderAction): Promise<HostingProviderResult> {
    await setAccountState(action.domain, action.reason ?? "remoção", "removeacct");
    return { ok: true };
  },
};

async function setAccountState(domain: string, reason: string, command: string): Promise<void> {
  const host = process.env.WHM_HOST;
  const token = process.env.WHM_API_TOKEN;
  const user = process.env.WHM_USER ?? "root";
  if (!host || !token) return;

  const params = new URLSearchParams({ cpaneluser: domain, reason });
  const url = `https://${host}:2087/json-api/${command}?${params.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `whm ${user}:${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`WHM ${command} falhou (HTTP ${res.status}).`);
  }
}