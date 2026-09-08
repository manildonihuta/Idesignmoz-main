// Domain provider: real availability via RDAP (public, free, no account)
// + optional Namecheap registration when credentials are configured.
//
// Availability works out of the box using RDAP (https://rdap.org).
// Registration requires you to set NAMECHEAP_API_USER, NAMECHEAP_API_KEY
// and NAMECHEAP_CLIENT_IP (your public IP allowlisted in Namecheap).

export type DomainCheck = {
  available: boolean;
  source: "rdap" | "namecheap" | "registry";
  message?: string;
};

let rdapCache: Record<string, string> | null = null;

/**
 * Fetch the IANA RDAP bootstrap map (TLD -> RDAP base URL) once and cache it.
 */
async function getRdapServers(): Promise<Record<string, string>> {
  if (rdapCache) return rdapCache;
  const res = await fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(8000) });
  const json = (await res.json()) as { services: [string[], string[]][] };
  const map: Record<string, string> = {};
  for (const [tlbs, urls] of json.services) {
    for (const tld of tlbs) map[tld.toLowerCase()] = urls[0];
  }
  rdapCache = map;
  return map;
}

/**
 * Resolve a TLD to its RDAP base URL via the IANA bootstrap so we can
 * query the authoritative RDAP server directly (rdap.org is unreliable).
 */
async function resolveRdapServer(fullDomain: string): Promise<string | null> {
  const dot = fullDomain.lastIndexOf(".");
  const tld = fullDomain.slice(dot + 1).toLowerCase();
  try {
    const servers = await getRdapServers();
    return servers[tld] ?? null;
  } catch {
    return null;
  }
}

/**
 * Check availability using RDAP.
 * RDAP returns 404 when a domain is not registered (available)
 * and 200 when it is registered (taken).
 */
export async function checkAvailabilityRdap(fullDomain: string): Promise<DomainCheck> {
  if (!fullDomain || !fullDomain.includes(".")) {
    return { available: false, source: "rdap", message: "Domínio inválido." };
  }

  const base = await resolveRdapServer(fullDomain);
  if (!base) {
    return { available: false, source: "rdap", message: "TLD sem servidor RDAP conhecido." };
  }

  try {
    const res = await fetch(`${base}/domain/${encodeURIComponent(fullDomain)}`, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    // 404 = no registration record = available.
    // 200 = has a registration record = taken.
    if (res.status === 404) return { available: true, source: "rdap" };
    if (res.status === 200) return { available: false, source: "rdap", message: "Nome já registado." };
    return { available: false, source: "rdap", message: "Servidor RDAP indisponível." };
  } catch {
    return { available: false, source: "rdap", message: "Não foi possível verificar via RDAP." };
  }
}

/**
 * Check availability via Namecheap API. Requires credentials + allowlisted IP.
 */
export async function checkAvailabilityNamecheap(fullDomain: string): Promise<DomainCheck> {
  const user = process.env.NAMECHEAP_API_USER;
  const key = process.env.NAMECHEAP_API_KEY;
  const clientIp = process.env.NAMECHEAP_CLIENT_IP;
  if (!user || !key || !clientIp) {
    return { available: false, source: "namecheap", message: "Namecheap não configurado." };
  }

  const url =
    `https://api.namecheap.com/xml.response?ApiUser=${encodeURIComponent(user)}` +
    `&ApiKey=${encodeURIComponent(key)}&UserName=${encodeURIComponent(user)}` +
    `&ClientIp=${encodeURIComponent(clientIp)}&Command=namecheap.domains.check` +
    `&DomainList=${encodeURIComponent(fullDomain)}`;

  try {
    const res = await fetch(url);
    const xml = await res.text();
    const available = !/<Available>false<\/Available>/i.test(xml) && /<Available>true<\/Available>/i.test(xml);
    return { available, source: "namecheap" };
  } catch {
    return { available: false, source: "namecheap", message: "Namecheap indisponível." };
  }
}

/**
 * Combined check: tries Namecheap when configured, otherwise falls back to RDAP.
 */
export async function checkDomainAvailability(fullDomain: string): Promise<DomainCheck> {
  const ncUser = process.env.NAMECHEAP_API_USER;
  const ncKey = process.env.NAMECHEAP_API_KEY;
  const ncIp = process.env.NAMECHEAP_CLIENT_IP;

  if (ncUser && ncKey && ncIp) {
    const nc = await checkAvailabilityNamecheap(fullDomain);
    if (nc.available) return nc;
    // If Namecheap errored (message set) but wasn't definitively registered, fall through to RDAP.
    if (nc.message) {
      const rdap = await checkAvailabilityRdap(fullDomain);
      if (rdap.message) return nc; // both failed
      return rdap;
    }
    return nc; // definitively not available via Namecheap
  }

  return checkAvailabilityRdap(fullDomain);
}

/**
 * Register a domain via Namecheap. Requires credentials + allowlisted IP.
 * Returns the registration or an error message.
 */
export async function registerDomainNamecheap(opts: {
  fullDomain: string;
  years?: number;
  promoCode?: string;
}): Promise<{ ok: boolean; error?: string; tld?: string }> {
  const user = process.env.NAMECHEAP_API_USER;
  const key = process.env.NAMECHEAP_API_KEY;
  const clientIp = process.env.NAMECHEAP_CLIENT_IP;
  if (!user || !key || !clientIp) {
    return { ok: false, error: "Namecheap não está configurado neste ambiente." };
  }

  const dot = opts.fullDomain.lastIndexOf(".");
  const sld = opts.fullDomain.slice(0, dot);
  const tld = opts.fullDomain.slice(dot + 1);
  const years = opts.years ?? 1;

  const url =
    `https://api.namecheap.com/xml.response?ApiUser=${encodeURIComponent(user)}` +
    `&ApiKey=${encodeURIComponent(key)}&UserName=${encodeURIComponent(user)}` +
    `&ClientIp=${encodeURIComponent(clientIp)}&Command=namecheap.domains.create` +
    `&DomainName=${encodeURIComponent(sld)}&Years=${years}` +
    `&TLD=${encodeURIComponent(tld)}`;

  try {
    const res = await fetch(url);
    const xml = await res.text();
    const ok = /Status="OK"/i.test(xml) || !/<Status>ERROR<\/Status>/i.test(xml);
    return { ok: ok && /<Domain>/i.test(xml), tld };
  } catch {
    return { ok: false, error: "Não foi possível contactar o registrador." };
  }
}
