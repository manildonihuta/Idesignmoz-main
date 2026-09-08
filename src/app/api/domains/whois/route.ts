import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{2,20})+$/i;

type RdapPayload = {
  entities?: Array<{ roles?: string[]; vcardArray?: unknown[] }>;
  events?: Array<{ eventAction?: string; eventDate?: string }>;
  status?: string | string[];
};

async function rdapWhois(fullDomain: string) {
  const dot = fullDomain.lastIndexOf(".");
  const tld = fullDomain.slice(dot + 1).toLowerCase();

  let servers: string[] = [];
  try {
    const res = await fetch("https://data.iana.org/rdap/dns.json", {
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { services: [string[], string[]][] };
    const match = json.services.find(([tlds]) =>
      tlds.some((t) => t.toLowerCase() === tld),
    );
    servers = match?.[1] ?? [];
  } catch {
    return null;
  }

  for (const base of servers) {
    try {
      const r = await fetch(
        `${base.replace(/\/$/, "")}/domain/${encodeURIComponent(fullDomain)}`,
        { signal: AbortSignal.timeout(8000), redirect: "follow" },
      );
      if (r.status !== 200) {
        continue;
      }
      const data = (await r.json()) as RdapPayload;

      const registrar =
        data.entities?.find((e) => (e.roles ?? []).includes("registrar")) ??
        data.entities?.[0];
      let registrarName: string | null = null;
      const card = registrar?.vcardArray?.[1];
      if (Array.isArray(card)) {
        const fn = card.find((row) => Array.isArray(row) && row[0] === "fn");
        if (fn && typeof fn[3] === "string") {
          registrarName = fn[3];
        }
      }

      const events: Record<string, string> = {};
      for (const ev of data.events ?? []) {
        if (ev.eventAction && ev.eventDate && !events[ev.eventAction]) {
          events[ev.eventAction] = ev.eventDate;
        }
      }

      return {
        domain: fullDomain,
        registrar: registrarName,
        registrationDate: events.registration ?? null,
        expirationDate: events.expiration ?? null,
        lastChanged: events["last changed"] ?? null,
        status: Array.isArray(data.status) ? data.status : data.status ? [data.status] : [],
      };
    } catch {
      // try next server
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, {
    prefix: "whois",
    limit: 20,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase() ?? "";
  if (!domain || !DOMAIN_RE.test(domain) || domain.length > 253) {
    return NextResponse.json(
      { ok: false, error: "Dominio invalido." },
      { status: 400 },
    );
  }

  const [whois, { data: local }] = await Promise.all([
    rdapWhois(domain),
    supabaseAdmin
      .from("domains")
      .select("expires_at")
      .eq("full_domain", domain)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    whois: {
      ...whois,
      localExpires: local?.expires_at ?? null,
      externalUrl: `https://who.is/whois/${domain}`,
    },
  });
}