import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "@/lib/provisioning/credentials";
import { serverLogError } from "@/lib/server-log";

/**
 * Provider credential vault. Secrets are stored ONLY as AES-256-GCM ciphertext
 * (encryptSecret/decryptSecret with the APP_ENCRYPTION_KEY KEK). The vault never
 * returns ciphertext to callers and masks every secret in listings. The service
 * layer (infra.service) audits every access; the frontend never sees a secret.
 */

export type ProviderCredentialRow = {
  id: string;
  provider_id: string | null;
  field: string;
  status: string;
  expires_at: string | null;
  rotated_at: string | null;
  last_verified_at: string | null;
  last_verified_ok: boolean | null;
  created_at: string;
  updated_at: string;
};

export type SafeProviderCredential = {
  id: string;
  providerSlug?: string;
  field: string;
  masked: string;
  status: string;
  expiresAt: string | null;
  rotatedAt: string | null;
  lastVerifiedAt: string | null;
  lastVerifiedOk: boolean | null;
  createdAt: string;
};

function encodeSecret(plain: string): string {
  return JSON.stringify(encryptSecret(plain));
}

function decodeSecret(encryptedData: string): string {
  const secret = JSON.parse(encryptedData) as EncryptedSecret;
  return decryptSecret(secret);
}

/** Masks a secret showing first 2 and last 2 characters (a weak-to-moderate hint). */
export function maskSecret(value: string): string {
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

function mapRow(row: ProviderCredentialRow): SafeProviderCredential {
  return {
    id: row.id,
    field: row.field,
    masked: "••••••••••",
    status: row.status,
    expiresAt: row.expires_at,
    rotatedAt: row.rotated_at,
    lastVerifiedAt: row.last_verified_at,
    lastVerifiedOk: row.last_verified_ok,
    createdAt: row.created_at,
  };
}

export async function storeProviderCredential(
  providerId: string,
  field: string,
  plain: string,
  opts?: { expiresAt?: string | null; verify?: boolean },
): Promise<boolean> {
  const encryptedData = encodeSecret(plain);
  const row = {
    provider_id: providerId,
    field,
    encrypted_data: encryptedData,
    expires_at: opts?.expiresAt ?? null,
    status: "active",
    ...(opts?.verify
      ? { last_verified_at: new Date().toISOString(), last_verified_ok: true }
      : {}),
  };
  const { error } = await supabaseAdmin.from("provider_credentials").upsert(row, { onConflict: "provider_id,field" });
  if (error) {
    serverLogError("infra:vault:store", error, { providerId, field });
    return false;
  }
  return true;
}

/**
 * Decrypts a single credential field. Callers must audit every invocation —
 * this is the only place a plaintext secret leaves the vault.
 */
export async function readProviderCredential(providerId: string, field: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("provider_credentials")
    .select("encrypted_data")
    .eq("provider_id", providerId)
    .eq("field", field)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return decodeSecret(data.encrypted_data as string);
  } catch {
    serverLogError("infra:vault:decrypt", "Falha ao decifrar credencial", { providerId, field });
    return null;
  }
}

export async function listProviderCredentials(providerId?: string): Promise<SafeProviderCredential[]> {
  let query = supabaseAdmin
    .from("provider_credentials")
    .select("provider_credentials.*, providers (id, slug, name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (providerId) {
    query = query.eq("provider_id", providerId);
  }
  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const mapped = mapRow(row as unknown as ProviderCredentialRow);
    const provider = (row as unknown as { providers: { slug: string } | { slug: string }[] | null }).providers;
    const slug = Array.isArray(provider) ? provider[0]?.slug : provider?.slug;
    return { ...mapped, providerSlug: slug ?? undefined };
  });
}

export async function testProviderCredential(id: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabaseAdmin
    .from("provider_credentials")
    .select("provider_id, field")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || !data.provider_id) return { ok: false, message: "Credencial não encontrada." };

  const plain = await readProviderCredential(data.provider_id, data.field as string);
  if (plain === null || plain.length === 0) {
    return { ok: false, message: "Não foi possível decifrar a credencial." };
  }
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("provider_credentials")
    .update({ last_verified_at: now, last_verified_ok: true })
    .eq("id", id);
  return { ok: true, message: "Credencial legível e válida." };
}

export async function rotateProviderCredential(id: string, newValue: string): Promise<boolean> {
  const { data, error: readError } = await supabaseAdmin
    .from("provider_credentials")
    .select("provider_id")
    .eq("id", id)
    .maybeSingle();
  if (readError || !data || !data.provider_id) return false;

  const encryptedData = encodeSecret(newValue);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("provider_credentials")
    .update({
      encrypted_data: encryptedData,
      rotated_at: now,
      status: "active",
      last_verified_at: now,
      last_verified_ok: true,
    })
    .eq("id", id);
  if (error) {
    serverLogError("infra:vault:rotate", error, { id });
    return false;
  }
  return true;
}

export async function revokeProviderCredential(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("provider_credentials")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}