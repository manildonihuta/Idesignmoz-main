import "server-only";

import { v2 as cloudinary } from "cloudinary";

type CloudConfig = { cloud_name: string; api_key: string; api_secret: string };

function parseCloudinaryUrl(url: string | undefined): CloudConfig | null {
  if (!url) return null;
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim());
  if (!m) return null;
  return { api_key: m[1], api_secret: m[2], cloud_name: m[3] };
}

const config = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
if (config) {
  cloudinary.config(config);
}
const isConfigured = Boolean(config);
const cloudName = config?.cloud_name ?? "";

function resourceTypeForKey(key: string, contentType = ""): "image" | "video" | "raw" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (/\.(mp4|mov|webm|avi|mkv)$/i.test(key)) return "video";
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico|heic)$/i.test(key)) return "image";
  return "raw";
}

export type StorageResult =
  | { ok: true; key: string; url: string }
  | { ok: false; reason: string };

export async function putObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType = "application/octet-stream",
): Promise<StorageResult> {
  if (!isConfigured) {
    return { ok: false, reason: "Storage Cloudinary não configurado" };
  }

  const resourceType = resourceTypeForKey(key, contentType);

  return new Promise<StorageResult>((resolve) => {
    let settled = false;
    const done = (result: StorageResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: key,
        resource_type: resourceType,
        overwrite: true,
        unique_filename: false,
        use_filename: false,
      },
      (error, result) => {
        if (error) {
          done({ ok: false, reason: String(error.message ?? error) });
          return;
        }
        if (!result) {
          done({ ok: false, reason: "Cloudinary: resposta vazia" });
          return;
        }
        const url = result.secure_url ?? result.url ?? "";
        if (!url) {
          done({ ok: false, reason: "Cloudinary: URL não devolvido" });
          return;
        }
        done({ ok: true, key, url });
      },
    );

    stream.on("error", (err) => done({ ok: false, reason: String(err) }));
    stream.write(Buffer.from(body));
    stream.end();
  });
}

export async function deleteObject(key: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isConfigured) {
    return { ok: false, reason: "Storage Cloudinary não configurado" };
  }

  const resourceType = resourceTypeForKey(key);

  const destroy = async (rt: "image" | "raw" | "video") => {
    try {
      const result = await cloudinary.uploader.destroy(key, { resource_type: rt });
      return result.result === "ok" || result.result === "not found";
    } catch {
      return null;
    }
  };

  const ok = (await destroy(resourceType)) ?? (await destroy("raw")) ?? (await destroy("image"));
  if (ok === null) {
    return { ok: false, reason: "Não foi possível apagar o ficheiro da Cloudinary" };
  }
  return { ok };
}

/**
 * A Cloudinary não tem URLs pré-assinados de upload S3 — usa assinaturas
 * via API (ver upload_sign). Mantém-se como null enquanto não for usado.
 */
export async function presignedUploadUrl(): Promise<null> {
  return null;
}

/** URL de entrega com assinatura e expiração (delivery autenticado). */
export async function presignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!isConfigured) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  try {
    return cloudinary.url(
      key,
      {
        type: "authenticated",
        sign_url: true,
        resource_type: resourceTypeForKey(key),
        secure: true,
        expires_at: expiresAt,
      },
    );
  } catch {
    return null;
  }
}

export function getObjectUrl(key: string): string {
  if (!cloudName) return "";
  return `https://res.cloudinary.com/${cloudName}/${resourceTypeForKey(key)}/upload/${key}`;
}