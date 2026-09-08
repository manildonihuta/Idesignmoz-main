import "server-only";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { encryptSecret, decryptSecret, type EncryptedSecret } from "@/lib/provisioning/credentials";

export const ENCRYPTION_KEY_CONFIGURED = Boolean(process.env.APP_ENCRYPTION_KEY);

export type SensitiveValue = EncryptedSecret;

export function encryptSensitive(plain: string): SensitiveValue {
  return encryptSecret(plain);
}

export function decryptSensitive(secret: SensitiveValue): string {
  return decryptSecret(secret);
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function strongToken(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}

export function strongCode(alphabet: string, length: number): string {
  let out = "";
  const max = alphabet.length;
  for (let i = 0; i < length; i += 1) {
    out += alphabet[randomInt(0, max)];
  }
  return out;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DOMAIN_AUTH_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function proposalCode(): string {
  return `PRO-${strongCode(CODE_ALPHABET, 4)}`;
}

export function domainAuthToken(bytes = 12): string {
  return strongCode(DOMAIN_AUTH_ALPHABET, bytes);
}