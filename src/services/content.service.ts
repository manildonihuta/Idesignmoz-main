import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  loadSiteSettings,
  saveSiteSettings,
  SETTING_KEYS,
  type SiteSettings,
} from "@/lib/site-settings";
import { getBaseCurrency, getFxRates, invalidateRatesCache } from "@/lib/money";
import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { getAnnualDiscount, getCatalogProductRows, getCrossSellRules } from "@/lib/content";
import { serverLogError } from "@/lib/server-log";
import { fail, type ServiceResult, type ServiceSuccess } from "./result";

/* --------------------------------------------------------------------- *
 * Public read-only snapshot (never exposes secrets)
 * --------------------------------------------------------------------- */

export async function publicSnapshot(): Promise<
  ServiceSuccess<{
    settings: Record<string, unknown>;
  }>
> {
  const s = await getSiteSettings();
  const baseCurrency = await getBaseCurrency();
  const rates = await getFxRates();

  const ratesPublic = Object.fromEntries(
    Object.entries(rates).map(([code, r]) => [code, r.mznPerUnitMillis / 1000]),
  );

  return {
    ok: true,
    settings: {
      general: {
        siteName: s.general.siteName,
        tagline: s.general.tagline,
        supportEmail: s.general.supportEmail,
        supportPhone: s.general.supportPhone,
        maintenanceMode: s.general.maintenanceMode,
      },
      branding: s.branding,
      tax: {
        rate: s.tax.rate,
        includedInPrices: s.tax.includedInPrices,
        taxName: s.tax.taxName,
      },
      currency: {
        base: baseCurrency,
        rates: ratesPublic,
      },
      payments: {
        defaultMethod: s.payments.defaultMethod,
        defaultCurrency: s.payments.defaultCurrency,
      },
      whatsapp: {
        phoneNumber: s.whatsapp.phoneNumber,
        defaultMessage: s.whatsapp.defaultMessage,
        enabled: s.whatsapp.enabled,
      },
      seo: {
        analyticsEnabled: s.seo.analyticsEnabled,
      },
    },
  };
}

/* --------------------------------------------------------------------- *
 * Public storefront catalog (DB-driven, never hard-coded prices)
 * --------------------------------------------------------------------- */

export async function catalog(): Promise<
  ServiceSuccess<{ products: unknown[]; rules: unknown[]; pricingToCatalog: Record<string, string>; annualDiscount: number }>
> {
  const [products, rules, annualDiscount] = await Promise.all([
    getCatalogProductRows(),
    getCrossSellRules(),
    getAnnualDiscount(),
  ]);

  const pricingToCatalog: Record<string, string> = {};
  for (const product of products) {
    for (const planName of product.for_pricing) {
      pricingToCatalog[planName] = product.id;
    }
  }

  return { ok: true, products, rules, pricingToCatalog, annualDiscount };
}

/* --------------------------------------------------------------------- *
 * Admin settings (settings.manage)
 * --------------------------------------------------------------------- */

export async function getSettings(): Promise<ServiceResult<{ settings: SiteSettings }>> {
  try {
    const settings = await loadSiteSettings();
    return { ok: true, settings };
  } catch (e) {
    serverLogError("service:content.getSettings", e);
    return fail(500, "Não foi possível carregar as definições.");
  }
}

export async function putSettings(
  body: unknown,
  updatedBy?: string,
): Promise<ServiceResult<{ settings: SiteSettings }>> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(400, "Corpo inválido.");
  }

  const values: Partial<SiteSettings> = {};
  for (const key of SETTING_KEYS) {
    const section = (body as Record<string, unknown>)[key];
    if (section && typeof section === "object" && !Array.isArray(section)) {
      (values as Record<string, unknown>)[key] = section;
    }
  }

  if (Object.keys(values).length === 0) {
    return fail(400, "Nenhuma definição válida para guardar.");
  }

  try {
    const settings = await saveSiteSettings(values, updatedBy ?? null);
    invalidateSiteSettingsCache();
    return { ok: true, settings };
  } catch (e) {
    serverLogError("service:content.putSettings", e);
    return fail(500, "Não foi possível guardar as definições.");
  }
}

/* --------------------------------------------------------------------- *
 * Admin FX rates (settings.manage)
 * --------------------------------------------------------------------- */

const RATES_TABLE = "currency_rates";

export async function getRates(): Promise<ServiceResult<{ rates: Partial<Record<CurrencyCode, number>> }>> {
  const { data, error } = await supabaseAdmin
    .from(RATES_TABLE)
    .select("code, rate")
    .order("code");
  if (error) {
    serverLogError("service:content.getRates", error);
    return fail(500, "Não foi possível carregar as taxas de câmbio.");
  }
  const rates: Partial<Record<CurrencyCode, number>> = {};
  for (const row of data ?? []) {
    if (isCurrencyCode(row.code)) rates[row.code] = Number(row.rate);
  }
  return { ok: true, rates };
}

export async function putRates(body: unknown): Promise<ServiceResult<{ rates: Partial<Record<CurrencyCode, number>> }>> {
  const rates = (body as { rates?: unknown } | undefined)?.rates;
  if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
    return fail(400, "Rates inválidos.");
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
    return fail(400, "Nenhum rate válido para guardar.");
  }

  const { data, error } = await supabaseAdmin
    .from(RATES_TABLE)
    .upsert(rows, { onConflict: "code" })
    .select("code, rate")
    .order("code");

  if (error) {
    serverLogError("service:content.putRates", error);
    return fail(500, "Não foi possível guardar as taxas de câmbio.");
  }

  invalidateRatesCache();

  const saved: Partial<Record<CurrencyCode, number>> = {};
  for (const row of data ?? []) {
    if (isCurrencyCode(row.code)) saved[row.code] = Number(row.rate);
  }
  return { ok: true, rates: saved };
}