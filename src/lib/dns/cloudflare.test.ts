import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: {} }));

import {
  cfDnssecStatusToDns,
  cfNameToRelative,
  cfRecordValueToString,
  cfZoneStatusToDns,
  cloudflareConfigured,
  cloudflareVerifyToken,
  dnsNameToCfFqdn,
} from "./providers/cloudflare";
import { getDnsProvider } from "./provider";
import { resolveBuiltinProvider } from "@/lib/providers/registry";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("cloudflare/status mapping", () => {
  it("mapeia estados de zona Cloudflare para o modelo interno", () => {
    expect(cfZoneStatusToDns("active")).toBe("active");
    expect(cfZoneStatusToDns("pending")).toBe("pending");
    expect(cfZoneStatusToDns("initializing")).toBe("pending");
    expect(cfZoneStatusToDns("deactivated")).toBe("error");
    expect(cfZoneStatusToDns("deleted")).toBe("error");
  });

  it("mapeia estados DNSSEC Cloudflare", () => {
    expect(cfDnssecStatusToDns("active")).toBe("active");
    expect(cfDnssecStatusToDns("pending")).toBe("pending");
    expect(cfDnssecStatusToDns("disabled")).toBe("disabled");
    expect(cfDnssecStatusToDns("unexpected")).toBe("error");
  });
});

describe("cloudflare/name mapping", () => {
  const base = "example.com";

  it("converte nomes relativos para FQDN no formato da Cloudflare", () => {
    expect(dnsNameToCfFqdn(base, "@")).toBe("example.com");
    expect(dnsNameToCfFqdn(base, "www")).toBe("www.example.com");
    expect(dnsNameToCfFqdn(base, "www.example.com")).toBe("www.example.com");
    expect(dnsNameToCfFqdn(base, "mail.example.com")).toBe("mail.example.com");
  });

  it("converte FQDN da Cloudflare de volta para relativo", () => {
    expect(cfNameToRelative(base, "example.com")).toBe("@");
    expect(cfNameToRelative(base, "www.example.com")).toBe("www");
    expect(cfNameToRelative(base, "Example.COM")).toBe("@");
  });
});

describe("cloudflare/value mapping", () => {
  it("usa content para registos simples", () => {
    expect(
      cfRecordValueToString({ id: "1", type: "A", name: "example.com", content: "1.2.3.4", ttl: 3600 }),
    ).toBe("1.2.3.4");
  });

  it("compõe CAA a partir do objeto data", () => {
    const value = cfRecordValueToString({
      id: "1",
      type: "CAA",
      name: "example.com",
      content: "",
      ttl: 3600,
      data: { flags: 0, tag: "issue", value: "letsencrypt.org" },
    });
    expect(value).toBe('0 issue "letsencrypt.org"');
  });

  it("compõe SRV a partir do objeto data", () => {
    const value = cfRecordValueToString({
      id: "1",
      type: "SRV",
      name: "_sip._tcp",
      content: "",
      ttl: 3600,
      data: { priority: 10, weight: 5, port: 5060, target: "sip.example.com" },
    });
    expect(value).toBe("10 5 5060 sip.example.com");
  });
});

describe("cloudflare/config", () => {
  it("reporta não configurado sem CLOUDFLARE_API_TOKEN", () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(cloudflareConfigured()).toBe(false);
  });

  it("reporta configurado com CLOUDFLARE_API_TOKEN", () => {
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(cloudflareConfigured()).toBe(true);
  });

  it("getDnsProvider sem token devolve o provedor local", () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(getDnsProvider(null).key).toBe("local");
  });

  it("getDnsProvider com token devolve Cloudflare por omissão", () => {
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(getDnsProvider(null).key).toBe("cloudflare");
    expect(getDnsProvider({ provider: "cloudflare" }).key).toBe("cloudflare");
  });

  it("zona cloudflare sem token resolve para Cloudflare (falha claramente na API)", () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(getDnsProvider({ provider: "cloudflare" }).key).toBe("cloudflare");
  });
});

describe("cloudflare/token verification", () => {
  it("aceita um token válido", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, errors: [], result: { id: "x", status: "active" } }), { status: 200 }),
      ),
    );
    await expect(cloudflareVerifyToken()).resolves.toBe(true);
  });

  it("rejeita um token inválido quando a API responde 401", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "bad";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false, errors: [{ code: 9103, message: "invalid" }] }), { status: 401 }),
      ),
    );
    await expect(cloudflareVerifyToken()).resolves.toBe(false);
  });
});

describe("cloudflare/registry", () => {
  it("expõe a definição built-in dns-cloudflare sem dns.nameservers", () => {
    const def = resolveBuiltinProvider("dns-cloudflare");
    expect(def).not.toBeNull();
    expect(def?.category).toBe("dns");
    expect(def?.adapter).toBe("CloudflareDnsProvider");
    expect(def?.capabilities).toContain("dns.zones");
    expect(def?.capabilities).toContain("dns.records");
    expect(def?.capabilities).toContain("dns.dnssec");
    expect(def?.capabilities).not.toContain("dns.nameservers");
    expect(def?.configured).toBe(false);
    expect(def?.endpoint).toContain("api.cloudflare.com");
  });
});