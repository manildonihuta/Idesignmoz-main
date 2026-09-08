import "server-only";

import type {
  DomainActionResult,
  DomainInquiryRequest,
  DomainInquiryResult,
  DomainNameservers,
  DomainRegistrar,
  DomainRegistrarCheck,
  DomainRegistrationRequest,
  DomainRegistrationResult,
  DomainSetNsRequest,
} from "../types";

/** Deterministic mock so the domain flow can be exercised end-to-end safely. */
export const simulatedRegistrar: DomainRegistrar = {
  id: "simulated",
  label: "Simulado",
  configured: true,

  async check(fullDomain: string): Promise<DomainRegistrarCheck> {
    const dot = fullDomain.lastIndexOf(".");
    const tld = fullDomain.slice(dot + 1).toLowerCase();
    const reserved = new Set(["google", "facebook", "idesignmoz", "moz"]);
    const label = fullDomain.split(".")[0].toLowerCase();
    return {
      available: !reserved.has(label),
      source: "simulated",
      message: tld.startsWith("mz") ? undefined : "TLD simulado — registo real require registrar configurado.",
    };
  },

  async register(req: DomainRegistrationRequest): Promise<DomainRegistrationResult> {
    return {
      ok: true,
      message: "Domínio registado (simulado).",
      registrantId: `DOM-${req.fullDomain.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase()}`,
      eppCode: `EPP-${Array.from({ length: 6 }, (_, i) => i).map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("")}`,
    };
  },

  async setNameservers(req: DomainSetNsRequest): Promise<DomainActionResult> {
    return { ok: true, message: `Nameservers definidos (simulado): ${req.nameservers.join(", ")}.` };
  },

  async getAuthCode(req: DomainInquiryRequest): Promise<DomainInquiryResult> {
    return { ok: true, authCode: `AUTH-${req.fullDomain.split(".")[0].toUpperCase()}`, message: "Auth code (simulado)." };
  },

  async renew(req: DomainInquiryRequest): Promise<DomainInquiryResult> {
    return { ok: true, expiry: `${new Date().getFullYear() + (req.extraYears ?? 1)}-${new Date().getMonth() + 1}-01` };
  },
};

export const DEFAULT_NAMESERVERS: DomainNameservers = ["ns1.idesignmoz.com", "ns2.idesignmoz.com"];