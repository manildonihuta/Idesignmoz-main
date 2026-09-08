/* --------------------------------------------------------------------- *
 * Catalog types & taxonomy — PURE module, safe on client.
 *
 * No product data, no prices, no I/O. Product rows live in the database
 * (`public.site_settings` -> `catalog_products`) and are served to clients
 * via `/api/catalog`. This module only holds the category enumeration,
 * labels/icons and the upsell topology so client components can render
 * without importing static catalog data.
 * --------------------------------------------------------------------- */

import { CURRENCY_SYMBOL, formatMoneyParts, type CurrencyCode } from "@/lib/currency";

export type ProductCategory =
  | "domain"
  | "hosting"
  | "email"
  | "website"
  | "branding"
  | "software"
  | "design"
  | "seo"
  | "marketing"
  | "maintenance";

export type ProductType = "one_time" | "recurring";
export type SellPeriod = "one_time" | "monthly" | "quarterly" | "semiannual" | "annual";

export type CatalogProduct = {
  id: string;               // unique catalog id, e.g. "hosting-shared-business"
  name: string;
  category: ProductCategory;
  type: ProductType;
  /** Price in integer minor units of `currency` (never float). */
  price: number;
  /** Recurring: annual price (integer minor units) when billed yearly. */
  annualPrice?: number;
  currency: CurrencyCode;   // ISO code; the app's principal is MZN
  description: string;
  features?: string[];
  href: string;
  icon?: string;
  meta?: Record<string, unknown>;
};

export const CATEGORY_LABEL_PT: Record<ProductCategory, string> = {
  domain: "Domínio",
  hosting: "Alojamento",
  email: "Email",
  website: "Website",
  branding: "Branding",
  software: "Software",
  design: "Design",
  seo: "SEO",
  marketing: "Marketing Digital",
  maintenance: "Manutenção",
};

export const CATEGORY_ICON: Record<ProductCategory, string> = {
  domain: "🌐",
  hosting: "🖥",
  email: "✉️",
  website: "◻️",
  branding: "🎨",
  software: "⚙️",
  design: "✏️",
  seo: "🔍",
  marketing: "📣",
  maintenance: "🛠",
};

/* --------------------------------------------------------------------- *
 * Upsell chain: the recommended next step after each category.
 *   Domain → Hosting → Email → Website → SEO → Marketing → Maintenance
 * --------------------------------------------------------------------- */

export const UPSEL_CHAIN: ProductCategory[] = [
  "domain",
  "hosting",
  "email",
  "website",
  "seo",
  "marketing",
  "maintenance",
];

export const UPSEL_AFTER: Record<ProductCategory, ProductCategory | null> = {
  domain: "hosting",
  hosting: "email",
  email: "website",
  website: "seo",
  seo: "marketing",
  marketing: "maintenance",
  maintenance: null,
  branding: "seo",
  software: "seo",
  design: "seo",
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "domain",
  "hosting",
  "email",
  "website",
  "branding",
  "software",
  "design",
  "seo",
  "marketing",
  "maintenance",
];

/* ----------------------------- Helpers ------------------------------ */

export function categoryLabel(cat: ProductCategory): string {
  return CATEGORY_LABEL_PT[cat];
}

/** Format a catalog product price in its own currency. */
export function formatProductPrice(p: Pick<CatalogProduct, "price" | "currency">): string {
  return formatMoneyParts(p.price, p.currency);
}

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCY_SYMBOL[code] ?? code;
}

export function sellPeriodLabel(period: SellPeriod): string {
  if (period === "monthly") return "por mês";
  if (period === "quarterly") return "por trimestre";
  if (period === "semiannual") return "por semestre";
  if (period === "annual") return "por ano";
  return "pagamento único";
}

/** Whether a category is part of the recurring revenue model. */
export function isRecurringCategory(cat: ProductCategory): boolean {
  return cat === "hosting" || cat === "email" || cat === "seo" || cat === "marketing" || cat === "maintenance" || cat === "domain";
}

export type CrossSellOffer = {
  category: ProductCategory;
  productId: string;
  eyebrow: string;
  headline: string;
  body: string;
  href: string;
};

export { CURRENCY_SYMBOL };