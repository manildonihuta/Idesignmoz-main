import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export type SaveMediaInput = {
  file: Uint8Array;
  mime: string;
  originalName: string;
  kind?: "logo" | "favicon" | "brand";
};

export type SaveMediaResult =
  | { ok: true; url: string; fileName: string; size: number; mime: string }
  | { ok: false; error: string; status: number };

export async function saveBrandingMedia({
  file,
  mime,
  originalName,
  kind = "brand",
}: SaveMediaInput): Promise<SaveMediaResult> {
  const cleanMime = mime.toLowerCase().trim();
  const ext = ALLOWED_MIME_TYPES[cleanMime] || extname(originalName).toLowerCase();

  if (!ALLOWED_MIME_TYPES[cleanMime] && !Object.values(ALLOWED_MIME_TYPES).includes(ext)) {
    return {
      ok: false,
      error: "Formato de ficheiro não suportado. Utilize PNG, JPG, WEBP, SVG ou ICO.",
      status: 400,
    };
  }

  if (file.byteLength > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: "O ficheiro é demasiado grande (máximo 2 MB).",
      status: 400,
    };
  }

  const hash = randomBytes(6).toString("hex");
  const timestamp = Date.now();
  const safeKind = kind.replace(/[^a-z0-9]/gi, "");
  const fileName = `${safeKind}-${timestamp}-${hash}${ext}`;

  const uploadsDir = join(process.cwd(), "public", "uploads", "branding");

  try {
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, fileName);
    await writeFile(filePath, file);

    const publicUrl = `/uploads/branding/${fileName}`;

    return {
      ok: true,
      url: publicUrl,
      fileName,
      size: file.byteLength,
      mime: cleanMime,
    };
  } catch (error) {
    return {
      ok: false,
      error: "Erro interno ao guardar o ficheiro no servidor.",
      status: 500,
    };
  }
}
