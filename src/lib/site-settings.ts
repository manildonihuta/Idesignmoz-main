import "server-only";

import { cacheDelete, withRedisCache } from "@/lib/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* --------------------------------------------------------------------- *
 * Site-wide admin settings.
 *
 * Stored as JSON per key in `public.site_settings`. Written only by staff
 * with `settings.manage` via /api/admin/settings; read via service role so
 * any server component/route can apply them live.
 * --------------------------------------------------------------------- */

const TABLE = "site_settings";

/* ----------------------------- General ----------------------------- */
export type GeneralSettings = {
  siteName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsApp: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  maintenanceMode: boolean;
};

export const DEFAULT_GENERAL: GeneralSettings = {
  siteName: "IDesign Moz",
  tagline: "Websites, alojamento e design em Moçambique",
  supportEmail: "info@idesignmoz.com",
  supportPhone: "+258 84 000 0000",
  supportWhatsApp: "+258840000000",
  address: "",
  city: "Maputo",
  country: "Moçambique",
  timezone: "Africa/Maputo",
  maintenanceMode: false,
};

/* ----------------------------- Branding ---------------------------- */
export type BrandingSettings = {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;      // CSS hex, drives accent
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  inkColor: string;
};

export const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: "/icon.png",
  faviconUrl: "/icon.png",
  primaryColor: "#5227ff",
  accentColor: "#5227ff",
  backgroundColor: "#0b0c0a",
  surfaceColor: "#14140f",
  textColor: "#f4f4ee",
  inkColor: "#ffffff",
};

/* ----------------------------- Domains ----------------------------- */
export type DomainsSettings = {
  defaultExtension: string;
  prices: Record<string, number>;      // extension -> annual price (MT)
  whoisEnabled: boolean;
  autoRenewEnabled: boolean;
};

export const DEFAULT_DOMAINS: DomainsSettings = {
  defaultExtension: ".com",
  prices: { com: 900, "co.mz": 1200, co: 1000, org: 1000, net: 1100, mz: 800 },
  whoisEnabled: true,
  autoRenewEnabled: true,
};

/* ----------------------------- Hosting ----------------------------- */
export type HostingSettings = {
  defaultPlan: string;
  provisioningEnabled: boolean;
  backupEnabled: boolean;
  sslEnabled: boolean;
  oversellRatio: number;
  supportContract: string;
  /** Grace (days) between `past_due` and `suspended`. */
  billingGraceDays: number;
  /** Retention (days) between `suspended` and `terminated`. */
  billingTerminationDays: number;
};

export const DEFAULT_HOSTING: HostingSettings = {
  defaultPlan: "shared-business",
  provisioningEnabled: true,
  backupEnabled: true,
  sslEnabled: true,
  oversellRatio: 1.2,
  supportContract: "",
  billingGraceDays: 7,
  billingTerminationDays: 30,
};

/* ----------------------------- Payments ---------------------------- */
export type GatewayConfig = {
  enabled: boolean;
  publishableKey?: string;
  secretKey?: string;
  feeRate?: number;           // 0..1 fraction
  sandbox: boolean;
};

export type PaymentsSettings = {
  defaultMethod: string;
  defaultCurrency: string;                 // ISO code: MZN (principal), USD, EUR, ZAR
  gateways: Record<string, GatewayConfig>;   // mpesa, emola, mkesh, visa, mastercard, bank-transfer
  invoiceNumberPrefix: string;
  invoiceFooter: string;
};

export const DEFAULT_PAYMENTS: PaymentsSettings = {
  defaultMethod: "mpesa",
  defaultCurrency: "MZN",
  gateways: {
    mpesa: { enabled: true, sandbox: true, feeRate: 0.005 },
    emola: { enabled: true, sandbox: true },
    mkesh: { enabled: true, sandbox: true },
    visa: { enabled: false, sandbox: true },
    mastercard: { enabled: false, sandbox: true },
    "bank-transfer": { enabled: false, sandbox: true },
  },
  invoiceNumberPrefix: "INV-",
  invoiceFooter: "Obrigado pela confiança!",
};

/* ----------------------------- Tax -------------------------------- */
export type TaxSettings = {
  rate: number;               // percent, e.g. 15 = 15%
  includedInPrices: boolean;
  taxId: string;              // company NUIF
  taxName: string;
};

export const DEFAULT_TAX: TaxSettings = {
  rate: 15,
  includedInPrices: true,
  taxId: "",
  taxName: "IVA",
};

/* ----------------------------- Email ------------------------------ */
export type EmailSettings = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  orderTemplateTitle: string;
  receiptTemplateTitle: string;
};

export const DEFAULT_EMAIL: EmailSettings = {
  fromName: "IDesign Moz",
  fromEmail: "no-reply@idesignmoz.com",
  replyTo: "info@idesignmoz.com",
  orderTemplateTitle: "Os seus serviços estão confirmados",
  receiptTemplateTitle: "O seu recibo",
};

/* ----------------------------- WhatsApp ---------------------------- */
export type WhatsAppSettings = {
  phoneNumber: string;
  defaultMessage: string;
  enabled: boolean;
};

export const DEFAULT_WHATSAPP: WhatsAppSettings = {
  phoneNumber: "+258840000000",
  defaultMessage: "Olá! Gostaria de mais informações.",
  enabled: true,
};

/* ----------------------------- SEO -------------------------------- */
export type SeoSettings = {
  titleTemplate: string;
  defaultDescription: string;
  ogImageUrl: string;
  robotsTxtExtra: string;
  analyticsEnabled: boolean;
};

export const DEFAULT_SEO: SeoSettings = {
  titleTemplate: "%s — IDesign Moz",
  defaultDescription: "Websites, alojamento, design e marketing digital em Moçambique.",
  ogImageUrl: "/og.png",
  robotsTxtExtra: "",
  analyticsEnabled: true,
};

/* ----------------------------- Security --------------------------- */
export type SecuritySettings = {
  rateLimitRequests: number;
  rateLimitWindow: number;    // seconds
  requireEmailVerification: boolean;
  allowRegistration: boolean;
  sessionTimeoutHours: number;
};

export const DEFAULT_SECURITY: SecuritySettings = {
  rateLimitRequests: 120,
  rateLimitWindow: 60,
  requireEmailVerification: false,
  allowRegistration: true,
  sessionTimeoutHours: 72,
};

/* ----------------------------- SMTP ------------------------------- */
export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
};

export const DEFAULT_SMTP: SmtpSettings = {
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
};

/* ----------------------------- Integrations ----------------------- */
export type IntegrationSettings = {
  resendApiKey: string;
  azureAppInsightsKey: string;
  vercelApiKey: string;
  objectStorageBucket: string;
  webhookUrl: string;
};

export const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  resendApiKey: "",
  azureAppInsightsKey: "",
  vercelApiKey: "",
  objectStorageBucket: "",
  webhookUrl: "",
};

/* ----------------------------- Container -------------------------- */

export type SiteSettingsKey =
  | "general"
  | "branding"
  | "domains"
  | "hosting"
  | "payments"
  | "tax"
  | "email"
  | "whatsapp"
  | "seo"
  | "security"
  | "smtp"
  | "integrations";

export type SiteSettings = {
  general: GeneralSettings;
  branding: BrandingSettings;
  domains: DomainsSettings;
  hosting: HostingSettings;
  payments: PaymentsSettings;
  tax: TaxSettings;
  email: EmailSettings;
  whatsapp: WhatsAppSettings;
  seo: SeoSettings;
  security: SecuritySettings;
  smtp: SmtpSettings;
  integrations: IntegrationSettings;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  general: DEFAULT_GENERAL,
  branding: DEFAULT_BRANDING,
  domains: DEFAULT_DOMAINS,
  hosting: DEFAULT_HOSTING,
  payments: DEFAULT_PAYMENTS,
  tax: DEFAULT_TAX,
  email: DEFAULT_EMAIL,
  whatsapp: DEFAULT_WHATSAPP,
  seo: DEFAULT_SEO,
  security: DEFAULT_SECURITY,
  smtp: DEFAULT_SMTP,
  integrations: DEFAULT_INTEGRATIONS,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SiteSettingsKey[];

/* ----------------------------- Helpers ---------------------------- */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Merge stored (partial) value over the defaults so missing keys stay sane. */
function mergeDefaults<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(stored)) return defaults;
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const k of Object.keys(out)) {
    const dv = out[k];
    const sv = stored[k];
    if (isPlainObject(dv) && isPlainObject(sv)) {
      out[k] = mergeDefaults(dv, sv);
    } else if (sv !== undefined) {
      out[k] = sv;
    }
  }
  return out as T;
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  const { data } = await supabaseAdmin.from(TABLE).select("key, value");
  const settings: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  for (const row of data ?? []) {
    const key = row.key as SiteSettingsKey;
    if (key in settings) {
      (settings as Record<string, unknown>)[key] = mergeDefaults(
        (DEFAULT_SETTINGS as Record<string, unknown>)[key],
        row.value,
      );
    }
  }
  return settings;
}

export async function loadSetting<K extends SiteSettingsKey>(key: K): Promise<SiteSettings[K]> {
  const all = await loadSiteSettings();
  return all[key];
}

/** Persist one or more sections. `values` merges partials over defaults. */
export async function saveSiteSettings(
  values: Partial<SiteSettings>,
  updatedBy?: string | null,
): Promise<SiteSettings> {
  const rows: { key: string; value: unknown; updated_by: string | null }[] = [];
  for (const key of Object.keys(values) as SiteSettingsKey[]) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    rows.push({
      key,
      value: values[key],
      updated_by: updatedBy ?? null,
    });
  }
  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from(TABLE).upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
  }
  return loadSiteSettings();
}

/* ----------------------------- Reactive cache ---------------------
 * So that live reads (currency, tax, brand) don't hammer the DB on every
 * render we keep a two-layer cache:
 *   L1: short in-process TTL (per lambda)
 *   L2: shared Redis TTL (across lambdas on Vercel)
 * Sensitive sections (smtp + integrations) are NEVER stored in the shared
 * cache — they are read straight from the DB. A settings save invalidates
 * both layers.
 * ----------------------------------------------------------------- */

const SENSITIVE_SETTING_KEYS: SiteSettingsKey[] = ["smtp", "integrations"];
const PUBLIC_SETTING_KEYS: SiteSettingsKey[] = SETTING_KEYS.filter(
  (key) => !SENSITIVE_SETTING_KEYS.includes(key),
);

const PUBLIC_CACHE_KEY = "cache:settings:public:v2";
const TTL_MS = 30_000;

let cachedPublic: { settings: SiteSettings; at: number } | null = null;

/** Load only the non-sensitive sections from the DB (avoids pulling secrets). */
async function loadPublicSiteSettings(): Promise<SiteSettings> {
  const { data } = await supabaseAdmin.from(TABLE).select("key, value").in("key", PUBLIC_SETTING_KEYS);
  const settings: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  for (const row of data ?? []) {
    const key = row.key as SiteSettingsKey;
    if (key in settings) {
      (settings as Record<string, unknown>)[key] = mergeDefaults(
        (DEFAULT_SETTINGS as Record<string, unknown>)[key],
        row.value,
      );
    }
  }
  return settings;
}

/** Load a single settings section, merging stored value over defaults. */
async function loadRawSetting<K extends SiteSettingsKey>(key: K): Promise<SiteSettings[K]> {
  const { data } = await supabaseAdmin.from(TABLE).select("value").eq("key", key).single();
  return mergeDefaults(
    (DEFAULT_SETTINGS as Record<string, unknown>)[key] as SiteSettings[K],
    data?.value,
  );
}

/** Public (non-secret) settings, cached in-process + shared Redis. */
export async function getPublicSiteSettings(): Promise<SiteSettings> {
  if (cachedPublic && Date.now() - cachedPublic.at < TTL_MS) {
    return cachedPublic.settings;
  }
  const settings = await withRedisCache(PUBLIC_CACHE_KEY, 30, loadPublicSiteSettings);
  cachedPublic = { settings, at: Date.now() };
  return settings;
}

/** Full settings. Bulk comes from the shared public cache; sensitive sections
 *  (smtp/integrations) are always read fresh so secrets never cross Redis. */
export async function getSiteSettings(): Promise<SiteSettings> {
  const publicSettings = await getPublicSiteSettings();
  const [smtp, integrations] = await Promise.all([
    loadRawSetting("smtp"),
    loadRawSetting("integrations"),
  ]);
  return {
    ...publicSettings,
    smtp,
    integrations,
  };
}

export function invalidateSiteSettingsCache(): void {
  cachedPublic = null;
  void cacheDelete(PUBLIC_CACHE_KEY);
}

/* ----------------------------- Company -----------------------------
 * Company identity used on invoices, proposals and receipts. Derived
 * entirely from configurable settings (general + tax), never hard-coded.
 * ------------------------------------------------------------------ */

export type CompanyInfo = {
  name: string;
  address: string;
  nuit: string;
  email: string;
};

export async function getCompanyInfo(): Promise<CompanyInfo> {
  const settings = await getSiteSettings();
  const address = [settings.general.address, settings.general.city, settings.general.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return {
    name: settings.general.siteName,
    address,
    nuit: settings.tax.taxId,
    email: settings.general.supportEmail,
  };
}