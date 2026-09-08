import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
  created: string;
};

const KEK = process.env.APP_ENCRYPTION_KEY;

function kek(): Buffer {
  if (!KEK) {
    throw new Error("APP_ENCRYPTION_KEY não definida. Credenciais de provisioning só podem ser cifradas com uma chave real.");
  }
  return createHash("sha256").update(KEK).digest();
}

export function encryptSecret(plain: string): EncryptedSecret {
  const key = kek();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
    created: new Date().toISOString(),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const key = kek();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.data, "base64")), decipher.final()]).toString("utf8");
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

export function randomStrongPassword(length = 18): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}