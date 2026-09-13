import "server-only";

import { HOSTING_PROVIDERS, selectHostingProvider } from "@/lib/provisioning/hosting/registry";
import { simulatedHostingProvider } from "@/lib/provisioning/hosting/providers/simulated";
import type { HostingProvider } from "@/lib/provisioning/hosting/types";
import { REGISTRARS, selectRegistrar } from "@/lib/provisioning/domain/registry";
import type { DomainRegistrar } from "@/lib/provisioning/domain/types";
import { getDnsProvider } from "@/lib/dns/provider";
import { cloudflareConfigured } from "@/lib/dns/providers/cloudflare";
import { LOCAL_DNS_CAPABILITIES, capabilitiesFromHostingProvider, capabilitiesFromRegistrar } from "./capabilities";
import type { InfraCapability, ProviderCategory } from "./types";

/**
 * Central provider registry — the single mapping between code-level provider
 * adapters and the DB `providers` rows (seeded by the infra migration). The
 * platform keeps a provider agnostic by routing every operation through these
 * adapters; the frontend never talks to a provider directly.
 */

export type BuiltinProviderDef = {
  slug: string;
  name: string;
  category: ProviderCategory;
  adapter: string;
  capabilities: InfraCapability[];
  isBuiltin: true;
  /** Truthful live status: an adapter only reports "active" once configured. */
  get configured(): boolean;
  /** Endpoint used by the health probe (may be undefined when DB-backed). */
  get endpoint(): string | null;
};

function hostingDef(slug: string, name: string, adapter: string, provider: HostingProvider): BuiltinProviderDef {
  return {
    slug,
    name,
    category: "hosting",
    adapter,
    capabilities: capabilitiesFromHostingProvider(provider),
    isBuiltin: true,
    get configured() {
      return provider.configured;
    },
    get endpoint() {
      return process.env.WHM_HOST ?? null;
    },
  };
}

function registrarDef(
  slug: string,
  name: string,
  adapter: string,
  registrar: DomainRegistrar,
  category: ProviderCategory,
): BuiltinProviderDef {
  return {
    slug,
    name,
    category,
    adapter,
    capabilities: capabilitiesFromRegistrar(registrar),
    isBuiltin: true,
    get configured() {
      return registrar.configured;
    },
    get endpoint() {
      return null;
    },
  };
}

export const BUILTIN_PROVIDERS: BuiltinProviderDef[] = [
  {
    slug: "hosting-simulated",
    name: "Alojamento Simulado",
    category: "hosting",
    adapter: "simulatedHostingProvider",
    capabilities: capabilitiesFromHostingProvider(simulatedHostingProvider),
    isBuiltin: true,
    get configured() {
      return true;
    },
    get endpoint() {
      return null;
    },
  },
  hostingDef("hosting-cpanel-whm", "cPanel / WHM", "whmProvider", HOSTING_PROVIDERS[0]),
  hostingDef("hosting-plesk", "Plesk", "pleskProvider", HOSTING_PROVIDERS[1]),
  hostingDef("hosting-cloud-vps", "Cloud VPS", "cloudVpsProvider", HOSTING_PROVIDERS[2]),
  {
    slug: "dns-local",
    name: "Registo DNS interno",
    category: "dns",
    adapter: "LocalDnsProvider",
    capabilities: LOCAL_DNS_CAPABILITIES,
    isBuiltin: true,
    get configured() {
      return true;
    },
    get endpoint() {
      return null;
    },
  },
  {
    slug: "dns-cloudflare",
    name: "Cloudflare DNS",
    category: "dns",
    adapter: "CloudflareDnsProvider",
    // Cloudflare emits its own nameservers and does not let users set them —
    // the capability stays truthful (absent) instead of advertised.
    capabilities: ["dns.zones", "dns.records", "dns.dnssec", "dns.propagation"] as InfraCapability[],
    isBuiltin: true,
    get configured() {
      return cloudflareConfigured();
    },
    get endpoint() {
      return "https://api.cloudflare.com/client/v4";
    },
  },
  registrarDef("domain-namecheap", "Namecheap", "namecheapRegistrar", REGISTRARS[0], "domain"),
  registrarDef("domain-simulated", "Registrador Simulado", "simulatedRegistrar", REGISTRARS[1], "domain"),
  {
    slug: "ssl-letsencrypt",
    name: "Let's Encrypt",
    category: "ssl",
    adapter: "letsencryptSSL",
    capabilities: ["ssl.issue", "ssl.install", "ssl.renew"],
    isBuiltin: true,
    get configured() {
      return false;
    },
    get endpoint() {
      return null;
    },
  },
  {
    slug: "email-platform",
    name: "Email da plataforma",
    category: "email",
    adapter: "platformEmail",
    capabilities: ["email.mailboxes"],
    isBuiltin: true,
    get configured() {
      return false;
    },
    get endpoint() {
      return null;
    },
  },
];

export function resolveBuiltinProvider(slug: string): BuiltinProviderDef | null {
  return BUILTIN_PROVIDERS.find((def) => def.slug === slug) ?? null;
}

/** True when a built-in adapter exists for a slug (provided or otherwise). */
export function isBuiltinSlug(slug: string): boolean {
  return BUILTIN_PROVIDERS.some((def) => def.slug === slug);
}

/** Live HostingProvider adapter matching an adapter name (falls back to simulated). */
export function resolveHostingAdapter(adapterName: string | null | undefined): HostingProvider {
  if (adapterName) {
    const match = HOSTING_PROVIDERS.find((provider) => provider.id === adapterName && provider.configured);
    if (match) return match;
    if (adapterName === "simulatedHostingProvider") return simulatedHostingProvider;
  }
  const provider = selectHostingProvider();
  return provider.provider;
}

/** Live DomainRegistrar adapter matching an adapter name (falls back to simulated). */
export function resolveRegistrarAdapter(adapterName: string | null | undefined): DomainRegistrar {
  if (adapterName) {
    const match = REGISTRARS.find((registrar) => registrar.id === adapterName && registrar.configured);
    if (match) return match;
  }
  const selection = selectRegistrar();
  return selection.registrar;
}

/** DNS adapter (the platform DNSProvider facade). */
export function resolveDnsAdapter(): ReturnType<typeof getDnsProvider> {
  return getDnsProvider(null);
}

export function builtinDefaultEndpoint(slug: string): string | null {
  return resolveBuiltinProvider(slug)?.endpoint ?? null;
}