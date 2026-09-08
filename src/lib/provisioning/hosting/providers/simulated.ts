import "server-only";

import { encryptSecret, randomStrongPassword } from "../../credentials";
import { DEFAULT_NAMESERVERS, deriveUsername } from "../helpers";
import type { HostingProvider, HostingProviderResult, HostingProvisionRequest, HostingProvisionResponse } from "../types";

/**
 * Simulated provider: used for demos and as a safe fallback when no
 * real provider is configured. Generates plausible credentials for
 * the admin flow to exercise end-to-end.
 */
export const simulatedHostingProvider: HostingProvider = {
  id: "simulated",
  label: "Simulado",
  configured: true,

  async provision(req: HostingProvisionRequest): Promise<HostingProvisionResponse> {
    const username = deriveUsername(req.domain, req.username);
    const password = randomStrongPassword();
    return {
      providerId: "simulated",
      providerLabel: "Simulado",
      accountId: `SRV-${req.domain.split(".")[0] ?? "host"}-${Date.now().toString(36).slice(-4)}`,
      panelUrl: "https://panel.idesignmoz.com (simulado)",
      username,
      nameservers: DEFAULT_NAMESERVERS,
      serverIp: "185.42.120.x (simulado)",
      planName: req.planName,
      createdAt: new Date().toISOString(),
      generatedPassword: password,
      encryptedPassword: encryptSecret(password),
    };
  },

  async suspend(): Promise<HostingProviderResult> {
    return { ok: true, message: "Simulado: conta suspensa." };
  },

  async unsuspend(): Promise<HostingProviderResult> {
    return { ok: true, message: "Simulado: conta reativada." };
  },

  async terminate(): Promise<HostingProviderResult> {
    return { ok: true, message: "Simulado: conta removida." };
  },
};