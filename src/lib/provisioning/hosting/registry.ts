import "server-only";

import { cloudVpsProvider } from "./providers/cloud-vps";
import { pleskProvider } from "./providers/plesk";
import { simulatedHostingProvider } from "./providers/simulated";
import { whmProvider } from "./providers/whm";
import type { HostingProvider } from "./types";

export const HOSTING_PROVIDERS: HostingProvider[] = [whmProvider, pleskProvider, cloudVpsProvider];

export type HostingProviderSelection = {
  provider: HostingProvider;
  mode: "live" | "simulated";
};

/**
 * Picks the first configured real provider, honouring an explicit
 * PROVISIONING_HOSTING_PROVIDER override (whm | plesk | cloud-vps | simulated).
 * Falls back to the simulated provider when nothing is configured.
 */
export function selectHostingProvider(): HostingProviderSelection {
  const forced = process.env.PROVISIONING_HOSTING_PROVIDER?.toLowerCase();

  if (forced && forced !== "simulated") {
    const match = HOSTING_PROVIDERS.find((p) => p.id === forced && p.configured);
    if (match) return { provider: match, mode: "live" };
  }

  const configured = HOSTING_PROVIDERS.find((p) => p.configured);
  if (configured && forced !== "simulated") {
    return { provider: configured, mode: "live" };
  }

  return { provider: simulatedHostingProvider, mode: "simulated" };
}