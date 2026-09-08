import "server-only";

import { checkDomainAvailability } from "@/lib/domain-provider";
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

const COMMAND_BASE = "https://api.namecheap.com/xml.response";

function apiUrl(command: string, params: Record<string, string>, tldOnlyDomain?: string): string {
  const user = process.env.NAMECHEAP_API_USER ?? "";
  const key = process.env.NAMECHEAP_API_KEY ?? "";
  const clientIp = process.env.NAMECHEAP_CLIENT_IP ?? "";
  const url = new URL(COMMAND_BASE);
  url.searchParams.set("ApiUser", user);
  url.searchParams.set("ApiKey", key);
  url.searchParams.set("UserName", user);
  url.searchParams.set("ClientIp", clientIp);
  url.searchParams.set("Command", command);
  if (tldOnlyDomain) {
    url.searchParams.set("SLD", tldOnlyDomain.split(".")[0]);
    url.searchParams.set("TLD", tldOnlyDomain.split(".").slice(1).join("."));
  }
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

function splitDomain(fullDomain: string): { sld: string; tld: string } {
  const parts = fullDomain.split(".");
  return { sld: parts[0], tld: parts.slice(1).join(".") };
}

/**
 * Namecheap registrar adapter. Requires NAMECHEAP_API_USER, NAMECHEAP_API_KEY
 * and NAMECHEAP_CLIENT_IP. Wraps the shared availability/registration helpers
 * and adds renew, auth code and nameserver operations.
 */
export const namecheapRegistrar: DomainRegistrar = {
  id: "namecheap",
  label: "Namecheap",
  get configured() {
    return Boolean(process.env.NAMECHEAP_API_USER && process.env.NAMECHEAP_API_KEY && process.env.NAMECHEAP_CLIENT_IP);
  },

  async check(fullDomain: string): Promise<DomainRegistrarCheck> {
    const check = await checkDomainAvailability(fullDomain);
    return { available: check.available, source: check.source, message: check.message };
  },

  async register(req: DomainRegistrationRequest): Promise<DomainRegistrationResult> {
    const { sld, tld } = splitDomain(req.fullDomain);
    const c = req.contact;

    const params: Record<string, string> = {
      DomainName: sld,
      Years: String(req.years ?? 1),
      TLD: tld,
      RegistrantFirstName: c.firstName ?? "",
      RegistrantLastName: c.lastName ?? c.org ?? "",
      RegistrantEmailAddress: c.email ?? "",
      RegistrantPhone: c.phone ?? "",
      RegistrantAddress1: c.address1 ?? "",
      RegistrantCity: c.city ?? "",
      RegistrantStateProvince: c.state ?? "",
      RegistrantPostalCode: c.zip ?? "",
      RegistrantCountry: c.country ?? "MZ",
      TechFirstName: c.firstName ?? "",
      TechLastName: c.lastName ?? c.org ?? "",
      TechEmailAddress: c.email ?? "",
    };

    let xml: string;
    try {
      const res = await fetch(apiUrl("namecheap.domains.create", params));
      xml = await res.text();
    } catch {
      return { ok: false, message: "Não foi possível contactar o registrador (Namecheap)." };
    }

    const statusOk = /Status="OK"/i.test(xml) || !/<Status>ERROR<\/Status>/i.test(xml);
    const registrantId = xml.match(/RegistrantID="([^"]+)"/i)?.[1] ?? xml.match(/domainid="([^"]+)"/i)?.[1];
    return {
      ok: Boolean(statusOk && /<Domain>/i.test(xml)),
      message: statusOk ? "Domínio registado." : "Namecheap devolveu erro.",
      registrantId,
    };
  },

  async setNameservers(req: DomainSetNsRequest): Promise<DomainActionResult> {
    const { sld, tld } = splitDomain(req.fullDomain);

    const params: Record<string, string> = { DomainName: req.fullDomain, SLD: sld, TLD: tld };
    req.nameservers.forEach((ns, i) => {
      params[`NameServer${i + 1}`] = ns;
    });

    let xml: string;
    try {
      const res = await fetch(apiUrl("namecheap.domains.dns.setCustom", params));
      xml = await res.text();
    } catch {
      return { ok: false, message: "Não foi possível atualizar os nameservers." };
    }
    return { ok: /Status="OK"/i.test(xml) || !/<Status>ERROR<\/Status>/i.test(xml) };
  },

  async getAuthCode(req: DomainInquiryRequest): Promise<DomainInquiryResult> {
    const { sld, tld } = splitDomain(req.fullDomain);
    const params: Record<string, string> = { DomainName: req.fullDomain };

    let xml: string;
    try {
      const res = await fetch(apiUrl("namecheap.domains.getRegistrarLock", params, `${sld}.${tld}`), {
        cache: "no-store",
      });
      xml = await res.text();
    } catch {
      return { ok: true, message: "Auth code não exposto via API — confirmar no painel Namecheap." };
    }

    const unlockUrl = xml.match(/<UnlockUrl>([^<]+)<\/UnlockUrl>/i)?.[1];
    return {
      ok: true,
      message: unlockUrl ? "Desbloqueia e obtém o auth code no URL devolvido." : "Auth code disponível no painel Namecheap.",
      authCode: unlockUrl,
    };
  },

  async renew(req: DomainInquiryRequest): Promise<DomainInquiryResult> {
    const { sld, tld } = splitDomain(req.fullDomain);
    const params: Record<string, string> = { Years: String(req.extraYears ?? 1) };

    let xml: string;
    try {
      const res = await fetch(apiUrl("namecheap.domains.renew", params, `${sld}.${tld}`));
      xml = await res.text();
    } catch {
      return { ok: false, message: "Não foi possível renovar o domínio." };
    }

    const expiry = xml.match(/<DomainName>.*?<\/DomainName>/i)?.[0] ?? undefined;
    return {
      ok: /Status="OK"/i.test(xml) || !/<Status>ERROR<\/Status>/i.test(xml),
      message: /Status="OK"/i.test(xml) ? "Domínio renovado." : "Namecheap devolveu erro na renovação.",
      expiry,
    };
  },
};

export function namecheapNameserversFrom(settingsNs?: DomainNameservers): DomainNameservers {
  return settingsNs && settingsNs.length > 0 ? settingsNs : ["ns1.idesignmoz.com", "ns2.idesignmoz.com"];
}