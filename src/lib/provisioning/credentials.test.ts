import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EncryptedSecret } from "./credentials";

const ORIGINAL_KEY = process.env.APP_ENCRYPTION_KEY;

async function loadCredentials(key: string) {
  process.env.APP_ENCRYPTION_KEY = key;
  vi.resetModules();
  return import("./credentials");
}

describe("credentials", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = ORIGINAL_KEY ?? "vitest-key";
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.APP_ENCRYPTION_KEY;
    } else {
      process.env.APP_ENCRYPTION_KEY = ORIGINAL_KEY;
    }
    vi.resetModules();
  });

  it("encripta e desencripta com round-trip", async () => {
    const { encryptSecret, decryptSecret } = await loadCredentials("k1");
    const secret = encryptSecret("s3cret!");
    expect(secret.algorithm).toBe("aes-256-gcm");
    expect(secret.data).not.toContain("s3cret");
    expect(decryptSecret(secret)).toBe("s3cret!");
  });

  it("produz segredos únicos com o mesmo texto (IV aleatório)", async () => {
    const { encryptSecret } = await loadCredentials("k2");
    const a = encryptSecret("mesmo-texto");
    const b = encryptSecret("mesmo-texto");
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it("falha a desencriptar com chave errada", async () => {
    const { encryptSecret } = await loadCredentials("k-ok");
    const secret = encryptSecret("importante");
    const { decryptSecret } = await loadCredentials("k-errada");
    expect(() => decryptSecret(secret)).toThrow();
  });

  it("recusa cifrar sem APP_ENCRYPTION_KEY", async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    vi.resetModules();
    const { encryptSecret } = await import("./credentials");
    expect(() => encryptSecret("x")).toThrow();
  });

  it("randomStrongPassword tem o comprimento e alfabeto esperados", async () => {
    const { randomStrongPassword } = await loadCredentials("k-pass");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    for (let i = 0; i < 20; i += 1) {
      const pass = randomStrongPassword(24);
      expect(pass).toHaveLength(24);
      for (const ch of pass) expect(alphabet).toContain(ch);
    }
    expect(randomStrongPassword()).toHaveLength(18);
  });

  it("suporta formatos EncryptedSecret válidos", async () => {
    const { encryptSecret } = await loadCredentials("k-type");
    const secret: EncryptedSecret = encryptSecret("valor");
    expect(secret).toMatchObject({
      algorithm: "aes-256-gcm",
      iv: expect.any(String),
      tag: expect.any(String),
      data: expect.any(String),
      created: expect.any(String),
    });
  });
});