import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { saveBrandingMedia } from "@/lib/media-upload";

export const dynamic = "force-dynamic";

const LIMIT = { prefix: "admin-media-upload", limit: 20, windowSec: 60 };

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    serverLogError("api:admin/media/upload", e);
    return Response.json({ ok: false, error: "Requisição multipart inválida." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: "Selecione uma imagem válida para carregar." }, { status: 400 });
  }

  const rawKind = form.get("kind");
  const kind =
    typeof rawKind === "string" && (rawKind === "logo" || rawKind === "favicon" || rawKind === "brand")
      ? rawKind
      : "brand";

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const result = await saveBrandingMedia({
    file: uint8Array,
    mime: file.type || "application/octet-stream",
    originalName: file.name,
    kind,
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    url: result.url,
    fileName: result.fileName,
    size: result.size,
    mime: result.mime,
  });
}
