import "server-only";

import { encryptSecret, randomStrongPassword } from "../../credentials";
import { DEFAULT_NAMESERVERS, deriveUsername } from "../helpers";
import type { HostingProvider, HostingProviderAction, HostingProviderResult, HostingProvisionRequest, HostingProvisionResponse } from "../types";

/**
 * Cloud VPS provisioning via a generic provider HTTP API.
 * Requires VPS_API_URL + VPS_API_KEY.
 *
 * Expected JSON contract (POST {apiUrl}/v1/accounts):
 *   request:  { hostname, plan, region, bandwidth, ram_mb, disk_gb, os }
 *   response: { id, ipv4, username, password }
 */
export const cloudVpsProvider: HostingProvider = {
  id: "cloud-vps",
  label: "Cloud VPS",
  get configured() {
    return Boolean(process.env.VPS_API_URL && process.env.VPS_API_KEY);
  },

  capabilities: ["accounts"] as const,

  async provision(req: HostingProvisionRequest): Promise<HostingProvisionResponse> {
    const apiUrl = process.env.VPS_API_URL!;
    const apiKey = process.env.VPS_API_KEY!;
    const username = deriveUsername(req.domain, req.username);

    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hostname: req.domain,
        plan: req.planName,
        region: process.env.VPS_REGION ?? "af-south",
        os: process.env.VPS_OS ?? "ubuntu-24.04",
        ram_mb: req.planLimits.ramMb,
        disk_gb: req.planLimits.diskGb,
        bandwidth: req.planLimits.bandwidthGb,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Cloud VPS API falhou (HTTP ${res.status}).`);
    }
    const payload = (await res.json()) as { id?: string; ipv4?: string };

    return {
      providerId: "cloud-vps",
      providerLabel: "Cloud VPS",
      accountId: payload.id ?? username,
      panelUrl: process.env.VPS_PANEL_URL,
      username,
      nameservers: DEFAULT_NAMESERVERS,
      serverIp: payload.ipv4,
      planName: req.planName,
      createdAt: new Date().toISOString(),
      generatedPassword: randomStrongPassword(),
      encryptedPassword: encryptSecret(randomStrongPassword()),
    };
  },

  async suspend(action: HostingProviderAction): Promise<HostingProviderResult> {
    return vpsSetStatus(action, "suspended");
  },

  async unsuspend(action: HostingProviderAction): Promise<HostingProviderResult> {
    return vpsSetStatus(action, "active");
  },

  async terminate(action: HostingProviderAction): Promise<HostingProviderResult> {
    const apiUrl = process.env.VPS_API_URL;
    const apiKey = process.env.VPS_API_KEY;
    if (!apiUrl || !apiKey) return { ok: false, message: "VPS_API_URL não configurado." };

    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/accounts/${encodeURIComponent(action.accountId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    return { ok: res.ok };
  },
};

async function vpsSetStatus(action: HostingProviderAction, status: string): Promise<HostingProviderResult> {
  const apiUrl = process.env.VPS_API_URL;
  const apiKey = process.env.VPS_API_KEY;
  if (!apiUrl || !apiKey) return { ok: false, message: "VPS_API_URL não configurado." };

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/accounts/${encodeURIComponent(action.accountId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
    signal: AbortSignal.timeout(15000),
  });
  return { ok: res.ok };
}