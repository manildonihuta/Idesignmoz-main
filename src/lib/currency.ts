/* --------------------------------------------------------------------- *
 * Currencies & integer minor-unit money — PURE module, safe on client.
 *
 * A monetary value is `Money = { amount, currency }` where `amount` is an
 * INTEGER in the currency's minor units (cents for USD/EUR/ZAR, whole
 * meticais for MZN which has 0 decimals). Money is never a float.
 *
 * This module has no I/O / no `server-only`, so it can be imported by client
 * components (cart, catalogue buttons, checkout). Server-side FX-rate
 * integration lives in `./money` (server-only).
 * --------------------------------------------------------------------- */

export type CurrencyCode = "MZN" | "USD" | "EUR" | "ZAR";

export const PRINCIPAL_CURRENCY: CurrencyCode = "MZN";

export const CURRENCY_EXPONENT: Record<CurrencyCode, number> = {
  MZN: 0,
  USD: 2,
  EUR: 2,
  ZAR: 2,
};

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  MZN: "MT",
  USD: "$",
  EUR: "€",
  ZAR: "R",
};

export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  MZN: "Metical",
  USD: "Dólar americano",
  EUR: "Euro",
  ZAR: "Rand sul-africano",
};

export const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  MZN: "pt-MZ",
  USD: "en-US",
  EUR: "pt-PT",
  ZAR: "en-ZA",
};

export const CURRENCY_CODES: CurrencyCode[] = ["MZN", "USD", "EUR", "ZAR"];

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === "string" && (CURRENCY_CODES as string[]).includes(v);
}

export function currencyHasDecimals(code: CurrencyCode): boolean {
  return CURRENCY_EXPONENT[code] > 0;
}

export type Money = {
  /** Integer minor units of `currency` (never float). */
  amount: number;
  currency: CurrencyCode;
};

export function money(amount: number, currency: CurrencyCode = PRINCIPAL_CURRENCY): Money {
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`Invalid money amount: expected an integer, got ${amount}`);
  }
  return { amount, currency };
}

/** MZN convenience constructor (amount is whole meticais). */
export function mzn(meticais: number): Money {
  return money(meticais, "MZN");
}

export const ZERO_MZN: Money = { amount: 0, currency: "MZN" };

/** Coerce a major-unit numeric/string (e.g. DB numeric(12,2)) to minor units. */
export function fromMajor(value: number | string, currency: CurrencyCode = PRINCIPAL_CURRENCY): Money {
  const num = Number(value);
  if (!Number.isFinite(num)) return money(0, currency);
  return money(Math.round(num * 10 ** CURRENCY_EXPONENT[currency]), currency);
}

/** Minor-unit integer -> major-unit decimal. */
export function toMajor(m: Money): number {
  return m.amount / 10 ** CURRENCY_EXPONENT[m.currency];
}

/* ----------------------------- Arithmetic ----------------------------- */

function ensureSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  ensureSame(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subMoney(a: Money, b: Money): Money {
  ensureSame(a, b);
  return money(a.amount - b.amount, a.currency);
}

/** Exact integer division with half-away-from-zero rounding. */
export function roundDiv(num: number, den: number): number {
  if (num === 0) return 0;
  const neg = num < 0 !== den < 0;
  const abs = Math.abs(num);
  let result = Math.floor(abs / den);
  if ((abs % den) * 2 >= den) result += 1;
  return neg ? -result : result;
}

/** Integer percentage of minor units, rounded half-away-from-zero. */
export function percentOf(value: Money, percent: number): Money {
  if (!Number.isFinite(percent)) return money(0, value.currency);
  const exp = CURRENCY_EXPONENT[value.currency];
  return money(roundDiv(value.amount * percent * 10 ** exp, 10000), value.currency);
}

/** Sum an array of Money (must all share the same currency). */
export function sumMoney(items: readonly Money[]): Money {
  if (items.length === 0) return ZERO_MZN;
  const currency = items[0].currency;
  let total = 0;
  for (const it of items) {
    ensureSame(it, money(0, currency));
    total += it.amount;
  }
  return money(total, currency);
}

/* ----------------------------- FX conversion ----------------------------- */

export const RATE_SCALE = 1000; // stored rates are `round(rate * 1000)`

export type FxRate = {
  from: CurrencyCode;
  /** Integer "millis": MZN minor units per 1 whole unit of `from`. */
  mznPerUnitMillis: number;
};

export function fxRate(from: CurrencyCode, rateMznPerUnit: number): FxRate {
  return { from, mznPerUnitMillis: Math.round(rateMznPerUnit * RATE_SCALE) };
}

/** Convert `m` (minor units of a foreign currency) into MZN minor units. */
export function toMznMinor(m: Money, rate: FxRate): number {
  if (rate.from !== m.currency) throw new Error(`Rate currency mismatch: ${rate.from} vs ${m.currency}`);
  if (m.currency === PRINCIPAL_CURRENCY) return m.amount;
  const exp = CURRENCY_EXPONENT[m.currency];
  return roundDiv(m.amount * rate.mznPerUnitMillis, RATE_SCALE * 10 ** exp);
}

/** Convert a foreign-currency Money into MZN using its FX rate. */
export function convertToMzn(m: Money, rate: FxRate): Money {
  const mznMin = toMznMinor(m, rate);
  return { amount: mznMin, currency: PRINCIPAL_CURRENCY };
}

/* ----------------------------- Formatting ----------------------------- */

export function formatMoney(m: Money): string {
  return formatMoneyParts(m.amount, m.currency);
}

export function formatMoneyParts(minor: number, currency: CurrencyCode): string {
  const keep = currencyHasDecimals(currency) ? 2 : 0;
  const major = minor / 10 ** CURRENCY_EXPONENT[currency];
  const nf = new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    minimumFractionDigits: keep,
    maximumFractionDigits: keep,
  });
  return `${nf.format(major)} ${CURRENCY_SYMBOL[currency]}`;
}

/** Plain MZN amount in whole meticais (no symbol, pt-MZ grouping). */
export function formatMZN(value: number): string {
  return new Intl.NumberFormat("pt-MZ").format(value);
}

/** MZN amount rounded to the nearest 100 meticais (no symbol, pt-MZ grouping). */
export function formatMZN100(value: number): string {
  const rounded = Math.round(value / 100) * 100;
  return new Intl.NumberFormat("pt-MZ").format(rounded);
}
