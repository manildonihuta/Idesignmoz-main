import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { invalidateRatesCache } from "@/lib/money";
import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const TABLE = "currency_rates";

/** Staff-only (settings.manage). Returns current FX rates (MZN per unit). */
export async function GET() {
  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  const { data, error } = await supabaseAdmin.from(TABLE).select("code, rate").order("code");
  if (error) {
    serverLogError("api:admin/rates", error);
    return Response.json({ ok: false, error: "Não foi possível carregar as taxas de câmbio." }, { status: 500 });
  }
  const rates: Partial<Record<CurrencyCode, number>> = {};
  for (const row of data ?? []) {
    if (isCurrencyCode(row.code)) rates[row.code] = Number(row.rate);
  }
  return Response.json({ ok: true, rates });
}

/** Staff-only (settings.manage). Updates FX rates (MZN per unit). */
export async function PUT(request: NextRequest) {
  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "admin-rates",
    limit: 60,
    windowSec: 60,
    ip: clientIp(request),
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/rates", e);
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const rates = (body as { rates?: unknown } | undefined)?.rates;
  if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
    return Response.json({ ok: false, error: "Rates inválidos." }, { status: 400 });
  }

  const rows: { code: string; rate: number }[] = [];
  for (const code of CURRENCY_CODES) {
    if (code === "MZN") continue; // principal; never edited
    const raw = (rates as Record<string, unknown>)[code];
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) continue;
    rows.push({ code, rate: num });
  }

  if (rows.length === 0) {
    return Response.json({ ok: false, error: "Nenhum rate válido para guardar." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(rows, { onConflict: "code" })
    .select("code, rate")
    .order("code");

  if (error) {
    serverLogError("api:admin/rates", error);
    return Response.json({ ok: false, error: "Não foi possível guardar as taxas de câmbio." }, { status: 500 });
  }

  invalidateRatesCache();

  const saved: Partial<Record<CurrencyCode, number>> = {};
  for (const row of data ?? []) {
    if (isCurrencyCode(row.code)) saved[row.code] = Number(row.rate);
  }
  return Response.json({ ok: true, rates: saved });
}