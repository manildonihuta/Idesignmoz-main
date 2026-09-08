import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { invalidateSiteSettingsCache, loadSiteSettings, saveSiteSettings, SETTING_KEYS, type SiteSettings } from "@/lib/site-settings";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

/** Staff-only (settings.manage). Returns the current full settings. */
export async function GET() {
  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  try {
    const settings = await loadSiteSettings();
    return Response.json({ ok: true, settings });
  } catch (e) {
    serverLogError("api:admin/settings", e);
    return Response.json(
      { ok: false, error: "Não foi possível carregar as definições." },
      { status: 500 },
    );
  }
}

/** Staff-only (settings.manage). Persists one or more settings sections. */
export async function PUT(request: NextRequest) {
  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "admin-settings",
    limit: 60,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/settings", e);
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const values: Partial<SiteSettings> = {};
  for (const key of SETTING_KEYS) {
    const section = (body as Record<string, unknown>)[key];
    if (section && typeof section === "object" && !Array.isArray(section)) {
      (values as Record<string, unknown>)[key] = section;
    }
  }

  if (Object.keys(values).length === 0) {
    return Response.json({ ok: false, error: "Nenhuma definição válida para guardar." }, { status: 400 });
  }

  try {
    const settings = await saveSiteSettings(values, String(guard.ctx.userId ?? ""));
    invalidateSiteSettingsCache();
    return Response.json({ ok: true, settings });
  } catch (e) {
    serverLogError("api:admin/settings", e);
    return Response.json(
      { ok: false, error: "Não foi possível guardar as definições." },
      { status: 500 },
    );
  }
}