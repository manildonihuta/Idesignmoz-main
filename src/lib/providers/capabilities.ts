import type { HostingProvider } from "@/lib/provisioning/hosting/types";
import type { DomainRegistrar } from "@/lib/provisioning/domain/types";
import type { InfraCapability, ProviderCapabilitySet } from "./types";
import { mapHostingCapability } from "./types";

export function hasCapability(caps: ProviderCapabilitySet | readonly string[] | null | undefined, key: InfraCapability): boolean {
  if (!caps) return false;
  return caps.includes(key);
}

/** Derives the infra capability set from an existing hostingle hosting adapter. */
export function capabilitiesFromHostingProvider(provider: HostingProvider): InfraCapability[] {
  const lifecycle: InfraCapability[] = [];
  const panel = provider.capabilities.map(mapHostingCapability);
  return [...lifecycle, ...panel];
}

/** Derives the infra capability set from an existing domain registrar adapter. */
export function capabilitiesFromRegistrar(registrar: DomainRegistrar): InfraCapability[] {
  void registrar;
  return ["domain.search", "domain.register", "domain.renew", "domain.nameservers"];
}

export const LOCAL_DNS_CAPABILITIES: InfraCapability[] = [
  "dns.zones",
  "dns.records",
  "dns.nameservers",
  "dns.dnssec",
  "dns.propagation",
];

export function providerCategoryForCapability(cap: InfraCapability): string {
  return cap.split(".")[0];
}

export function groupCapabilitiesByCategory(caps: ProviderCapabilitySet): Record<string, InfraCapability[]> {
  const grouped: Record<string, InfraCapability[]> = {};
  for (const cap of caps) {
    const category = cap.split(".")[0];
    (grouped[category] ??= []).push(cap);
  }
  return grouped;
}