import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET ?? "idesignmoz";
const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";

const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey);

function client(): S3Client | null {
  if (!isConfigured) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function objectUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL ?? `https://${bucket}.r2.dev`;
  return `${base.replace(/\/$/, "")}/${key}`;
}

export type StorageResult =
  | { ok: true; key: string; url: string }
  | { ok: false; reason: string };

export async function putObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType = "application/octet-stream",
): Promise<StorageResult> {
  const c = client();
  if (!c) {
    return { ok: false, reason: "Storage R2/S3 não configurado" };
  }
  try {
    await c.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { ok: true, key, url: objectUrl(key) };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export async function deleteObject(key: string): Promise<{ ok: boolean; reason?: string }> {
  const c = client();
  if (!c) {
    return { ok: false, reason: "Storage R2/S3 não configurado" };
  }
  try {
    await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export async function presignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string | null> {
  const c = client();
  if (!c) {
    return null;
  }
  try {
    return await getSignedUrl(
      c,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn },
    );
  } catch {
    return null;
  }
}

export async function presignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string | null> {
  const c = client();
  if (!c) {
    return null;
  }
  try {
    return await getSignedUrl(
      c,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
  } catch {
    return null;
  }
}

export function getObjectUrl(key: string): string {
  return objectUrl(key);
}