import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: {} }));

import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  classifyProviderError,
  computeBackoffMs,
} from "./errors";
import {
  LOCAL_DNS_CAPABILITIES,
  capabilitiesFromHostingProvider,
  capabilitiesFromRegistrar,
  hasCapability,
} from "./capabilities";
import { mapHostingCapability } from "./types";
import { verifyWebhookSignature, signWebhookPayload, newWebhookSecret } from "./webhooks";
import { maskSecret } from "./vault";
import { simulatedHostingProvider } from "@/lib/provisioning/hosting/providers/simulated";
import { REGISTRARS } from "@/lib/provisioning/domain/registry";

describe("providers/errors", () => {
  it("classifica erros de autenticação como permanentes", () => {
    const classified = classifyProviderError(new ProviderAuthenticationError("token inválido"));
    expect(classified.kind).toBe("authentication");
    expect(classified.retryable).toBe(false);
    expect(classified.permanent).toBe(true);
  });

  it("classifica HTTP 429 como rate limit re-tentável", () => {
    const classified = classifyProviderError({ status: 429, message: "too many requests" });
    expect(classified.kind).toBe("rate_limit");
    expect(classified.retryable).toBe(true);
  });

  it("classifica erros 5xx como indisponibilidade do fornecedor", () => {
    const classified = classifyProviderError({ status: 503, message: "unavailable" });
    expect(classified.kind).toBe("provider_unavailable");
    expect(classified.retryable).toBe(true);
  });

  it("classifica timeouts e falhas de rede como re-tentáveis", () => {
    expect(classifyProviderError(new ProviderTimeoutError("timed out")).kind).toBe("timeout");
    const network = classifyProviderError(new Error("fetch failed: ECONNRESET"));
    expect(network.kind).toBe("network");
    expect(network.retryable).toBe(true);
  });

  it("mensagens desconhecidas caem para unknown permanente", () => {
    const classified = classifyProviderError(new Error("alguma coisa"));
    expect(classified.kind).toBe("unknown");
    expect(classified.retryable).toBe(false);
  });

  it("computeBackoffMs cresce com o número de tentativas", () => {
    const first = computeBackoffMs(0);
    const second = computeBackoffMs(1);
    expect(first).toBeGreaterThanOrEqual(60_000);
    expect(first).toBeLessThan(75_000);
    expect(second).toBeGreaterThan(first);
  });
});

describe("providers/capabilities", () => {
  it("hasCapability respeita a lista e valores nulos", () => {
    expect(hasCapability(["dns.zones", "dns.records"], "dns.zones")).toBe(true);
    expect(hasCapability(["dns.zones"], "dns.records")).toBe(false);
    expect(hasCapability(null, "dns.zones")).toBe(false);
    expect(hasCapability(undefined, "dns.zones")).toBe(false);
  });

  it("mapeia capacidades de alojamento existentes", () => {
    expect(mapHostingCapability("accounts")).toBe("hosting.accounts");
    expect(mapHostingCapability("websites")).toBe("hosting.websites");
    expect(mapHostingCapability("databases")).toBe("hosting.databases");
    expect(mapHostingCapability("ssl")).toBe("hosting.ssl");
  });

  it("deriva as capacidades infra do fornecedor simulado", () => {
    const caps = capabilitiesFromHostingProvider(simulatedHostingProvider);
    expect(caps).toContain("hosting.accounts");
    expect(caps).toContain("hosting.usage");
    expect(caps).toContain("hosting.websites");
    expect(caps).not.toContain("hosting.files");
    expect(caps).not.toContain("hosting.ssh");
  });

  it("registrador expõe apenas capacidades de domínio suportadas", () => {
    const caps = capabilitiesFromRegistrar(REGISTRARS[0]);
    expect(caps).toContain("domain.search");
    expect(caps).toContain("domain.register");
    expect(caps).toContain("domain.renew");
    expect(caps).toContain("domain.nameservers");
  });

  it("DNS local cobre zonas, registos, nameservers e DNSSEC", () => {
    for (const capability of ["dns.zones", "dns.records", "dns.nameservers", "dns.dnssec", "dns.propagation"]) {
      expect(LOCAL_DNS_CAPABILITIES).toContain(capability);
    }
  });
});

describe("providers/webhooks", () => {
  it("assinatura HMAC é verificada com o segredo correto", () => {
    const secret = newWebhookSecret();
    const body = JSON.stringify({ type: "ping" });
    const signature = signWebhookPayload(body, secret);
    const result = verifyWebhookSignature(signature, body, secret);
    expect(result.ok).toBe(true);
  });

  it("rejeita assinatura com segredo errado", () => {
    const body = JSON.stringify({ type: "ping" });
    const signature = signWebhookPayload(body, "secret-a");
    const result = verifyWebhookSignature(signature, body, "secret-b");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Assinatura inválida");
  });

  it("rejeita corpo adulterado", () => {
    const secret = "segredo-de-teste";
    const signature = signWebhookPayload('{"type":"ping"}', secret);
    const result = verifyWebhookSignature(signature, '{"type":"pong"}', secret);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Assinatura inválida");
  });

  it("rejeita assinaturas antigas (janela de replay)", () => {
    const secret = "segredo-de-teste";
    const body = '{"type":"ping"}';
    const stale = createHmac("sha256", secret)
      .update(`1600000000.${body}`)
      .digest("hex");
    const result = verifyWebhookSignature(`t=1600000000;v1=${stale}`, body, secret);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Assinatura expirada");
  });

  it("rejeita assinatura ausente ou mal formada", () => {
    const secret = "segredo-de-teste";
    expect(verifyWebhookSignature(null, "{}", secret).ok).toBe(false);
    expect(verifyWebhookSignature("v1=abc", "{}", secret).ok).toBe(false);
  });

  it("newWebhookSecret gera 64 caracteres hexadecimais", () => {
    const secret = newWebhookSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(secret)).toBe(true);
  });
});

describe("providers/vault", () => {
  it("maskSecret nunca expõe o valor completo", () => {
    expect(maskSecret("abcdef")).toBe("••••••");
    expect(maskSecret("s3cret123456")).toBe("s3••••56");
    expect(maskSecret("s3cret123456")).not.toContain("cret");
  });
});