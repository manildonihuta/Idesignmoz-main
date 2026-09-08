import "server-only";

import { getSiteSettings } from "@/lib/site-settings";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  fxRate,
  isCurrencyCode,
  PRINCIPAL_CURRENCY,
  type CurrencyCode,
  type FxRate,
} from "@/lib/currency";

export {
  addMoney,
  convertToMzn,
  CURRENCY_CODES,
  CURRENCY_EXPONENT,
  CURRENCY_LABEL,
  CURRENCY_LOCALE,
  CURRENCY_SYMBOL,
  currencyHasDecimals,
  formatMoney,
  formatMoneyParts,
  fromMajor,
  fxRate,
  isCurrencyCode,
  money,
  mzn,
  percentOf,
  PRINCIPAL_CURRENCY,
  RATE_SCALE,
  roundDiv,
  subMoney,
  sumMoney,
  toMajor,
  toMznMinor,
  ZERO_MZN,
  type CurrencyCode,
  type FxRate,
  type Money,
} from "@/lib/currency";

const RATES_KEY = "currency_rates";

let ratesCache: Record<string, FxRate> | null = null;
let ratesCacheAt = 0;
const RATES_TTL = 60_000;

export async function getBaseCurrency(): Promise<CurrencyCode> {
  const settings = await getSiteSettings();
  const code = (settings.payments as { defaultCurrency?: string } | undefined)?.defaultCurrency;
  return isCurrencyCode(code) ? code : PRINCIPAL_CURRENCY;
}

/** Load the FX rate for a foreign currency (MZN per 1 unit) from the DB. */
export async function getFxRate(currency: CurrencyCode): Promise<FxRate> {
  if (currency === PRINCIPAL_CURRENCY) {
    return fxRate(PRINCIPAL_CURRENCY, 1);
  }
  await refreshRates();
  const cachedRate = ratesCache?.[currency];
  if (cachedRate) return cachedRate;
  return defaultRate(currency);
}

export async function getFxRates(): Promise<Partial<Record<CurrencyCode, FxRate>>> {
  await refreshRates();
  return ratesCache ?? {};
}

async function refreshRates(): Promise<void> {
  if (ratesCache && Date.now() - ratesCacheAt < RATES_TTL) return;
  try {
    const { data } = await supabaseAdmin.from(RATES_KEY).select("code, rate");
    const map: Record<string, FxRate> = {};
    for (const row of data ?? []) {
      if (isCurrencyCode(row.code) && typeof row.rate === "number") {
        map[row.code] = fxRate(row.code, row.rate);
      }
    }
    ratesCache = map;
    ratesCacheAt = Date.now();
  } catch {
    // keep defaults
  }
}

/** Sensible defaults if no rates are configured (approx. MZN per unit). */
function defaultRate(currency: CurrencyCode): FxRate {
  const approx: Partial<Record<CurrencyCode, number>> = {
    USD: 64,
    EUR: 69.5,
    ZAR: 3.55,
  };
  return fxRate(currency, approx[currency] ?? 1);
}

export function invalidateRatesCache(): void {
  ratesCache = null;
}
