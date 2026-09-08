import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { CurrencyCode } from "@/lib/currency";
import type { Service, ServiceCategory } from "@/lib/services";
import type { BlogCategory, BlogPost } from "@/lib/blog";
import type { Project, ProjectCategory } from "@/lib/portfolio";
import type { HostingPlan, HostingCategory } from "@/lib/hosting-plans";
import type { PricingEntry, PricingCategory } from "@/lib/pricing-plans";
import type { CatalogProduct, ProductCategory, ProductType, CrossSellOffer } from "@/lib/catalog-types";
import type { ProposalServiceItem } from "@/lib/proposals";

/* --------------------------------------------------------------------- *
 * Content layer.
 *
 * All marketing/content is data-driven, stored as JSON per key in
 * `public.site_settings` (seeded by `scripts/seed-content.test.ts`). Reads
 * go through the service role with a short in-process TTL so pages render
 * fast without hammering the DB, while staying live-editable.
 * --------------------------------------------------------------------- */

const TABLE = "site_settings";

export type Testimonial = { quote: string; name: string; role: string };

export type CrossSellRule = {
  trigger: ProductCategory;
  category: ProductCategory;
  productId?: string;
  eyebrow: string;
  headline: string;
  body: string;
  sort: number;
};

export type CatalogProductRow = CatalogProduct & {
  for_services: string[];
  for_pricing: string[];
};

/* ----------------------------- Empty fallbacks --------------------- */

const EMPTY_SERVICES: Service[] = [];
const EMPTY_BLOG_CATEGORIES: BlogCategory[] = [];
const EMPTY_BLOG_POSTS: BlogPost[] = [];
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_HOSTING: HostingPlan[] = [];
const EMPTY_PRICING: PricingEntry[] = [];
const EMPTY_CATALOG: CatalogProductRow[] = [];
const EMPTY_CROSS_SELL: CrossSellRule[] = [];
const EMPTY_TESTIMONIALS: Testimonial[] = [];
const EMPTY_PROPOSAL_CATALOG: ProposalServiceItem[] = [];

/* ----------------------------- Cache ------------------------------- */

type Bundle = {
  services: Service[];
  blogCategories: BlogCategory[];
  blogPosts: BlogPost[];
  projects: Project[];
  hostingPlans: HostingPlan[];
  pricingPlans: PricingEntry[];
  pricing: { annualDiscount: number };
  catalogProducts: CatalogProductRow[];
  crossSellRules: CrossSellRule[];
  testimonials: Testimonial[];
  proposalCatalog: ProposalServiceItem[];
};

let cached: { bundle: Bundle; at: number } | null = null;
const TTL_MS = 30_000;

function mapCatalogRow(r: Record<string, unknown>): CatalogProductRow {
  return {
    id: String(r.id),
    name: String(r.name),
    category: r.category as ProductCategory,
    type: r.type as ProductType,
    price: Number(r.price),
    annualPrice: r.annual_price != null ? Number(r.annual_price) : undefined,
    currency: (r.currency as CurrencyCode) ?? "MZN",
    description: String(r.description ?? ""),
    features: Array.isArray(r.features) ? (r.features as string[]) : undefined,
    href: String(r.href ?? ""),
    icon: typeof r.icon === "string" ? r.icon : undefined,
    meta: (r.meta ?? {}) as Record<string, unknown>,
    for_services: Array.isArray(r.for_services) ? (r.for_services as string[]) : [],
    for_pricing: Array.isArray(r.for_pricing) ? (r.for_pricing as string[]) : [],
  };
}

let catalogCache: { rows: CatalogProductRow[]; at: number } | null = null;

async function loadCatalogRelational(): Promise<CatalogProductRow[]> {
  const { data, error } = await supabaseAdmin
    .from("catalog_products")
    .select("id, name, category, type, price, annual_price, currency, description, features, href, icon, meta, for_services, for_pricing, active")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => mapCatalogRow(r as Record<string, unknown>));
}

/** Buyable catalog. Reads the relational `catalog_products` table (P4); falls
 * back to the legacy site_settings JSON bundle during transition. */
export async function getCatalogProductRows(): Promise<CatalogProductRow[]> {
  if (catalogCache && Date.now() - catalogCache.at < TTL_MS) {
    return catalogCache.rows;
  }
  const relational = await loadCatalogRelational();
  const rows =
    relational.length > 0
      ? relational
      : ((await getContentBundle()).catalogProducts as CatalogProductRow[]);
  catalogCache = { rows, at: Date.now() };
  return rows;
}

export function invalidateCatalogCache(): void {
  catalogCache = null;
}

async function loadBundle(): Promise<Bundle> {
  const { data } = await supabaseAdmin.from(TABLE).select("key, value");
  const rows = new Map((data ?? []).map((r) => [r.key, r.value]));
  const bundle: Bundle = {
    services: (rows.get("services") as Service[]) ?? EMPTY_SERVICES,
    blogCategories: (rows.get("blog_categories") as BlogCategory[]) ?? EMPTY_BLOG_CATEGORIES,
    blogPosts: (rows.get("blog_posts") as BlogPost[]) ?? EMPTY_BLOG_POSTS,
    projects: (rows.get("portfolio_projects") as Project[]) ?? EMPTY_PROJECTS,
    hostingPlans: (rows.get("hosting_plans") as HostingPlan[]) ?? EMPTY_HOSTING,
    pricingPlans: (rows.get("pricing_plans") as PricingEntry[]) ?? EMPTY_PRICING,
    pricing: {
      annualDiscount: Number((rows.get("pricing") as { annualDiscount?: number } | undefined)?.annualDiscount ?? 20),
    },
    catalogProducts: (rows.get("catalog_products") as CatalogProductRow[]) ?? EMPTY_CATALOG,
    crossSellRules: (rows.get("cross_sell_rules") as CrossSellRule[]) ?? EMPTY_CROSS_SELL,
    testimonials: (rows.get("testimonials") as Testimonial[]) ?? EMPTY_TESTIMONIALS,
    proposalCatalog: (rows.get("proposal_catalog") as ProposalServiceItem[]) ?? EMPTY_PROPOSAL_CATALOG,
  };
  return bundle;
}

export async function getContentBundle(): Promise<Bundle> {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.bundle;
  }
  const bundle = await loadBundle();
  cached = { bundle, at: Date.now() };
  return bundle;
}

export function invalidateContentCache(): void {
  cached = null;
}

/* ----------------------------- Getters ----------------------------- */

export async function getServices(): Promise<Service[]> {
  return (await getContentBundle()).services;
}

export async function getService(slug: string): Promise<Service | undefined> {
  const services = await getServices();
  return services.find((s) => s.slug === slug);
}

export async function getServicesByCategory(category: ServiceCategory | "All"): Promise<Service[]> {
  const services = await getServices();
  if (category === "All") return services;
  return services.filter((s) => s.category === category);
}

export const getServiceCategories = async (): Promise<ServiceCategory[]> =>
  ["Web", "Branding", "Marketing", "SEO", "Software", "Design"];

export async function getBlogCategories(): Promise<BlogCategory[]> {
  return (await getContentBundle()).blogCategories;
}

export async function getBlogCategory(slug: string): Promise<BlogCategory | undefined> {
  const categories = await getBlogCategories();
  return categories.find((c) => c.slug === slug);
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  return (await getContentBundle()).blogPosts;
}

export async function getBlogPost(slug: string): Promise<BlogPost | undefined> {
  const posts = await getBlogPosts();
  return posts.find((p) => p.slug === slug);
}

export async function getPostsByCategory(slug: string): Promise<BlogPost[]> {
  const posts = await getBlogPosts();
  return posts.filter((p) => p.category === slug);
}

export async function getProjects(): Promise<Project[]> {
  return (await getContentBundle()).projects;
}

export async function getProject(slug: string): Promise<Project | undefined> {
  const projects = await getProjects();
  return projects.find((p) => p.slug === slug);
}

export async function getProjectsByCategory(category: ProjectCategory | "All"): Promise<Project[]> {
  const projects = await getProjects();
  if (category === "All") return projects;
  return projects.filter((p) => p.categories.includes(category));
}

export const getProjectCategories = async (): Promise<ProjectCategory[]> =>
  ["Websites", "E-commerce", "Branding", "Apps", "Marketing"];

export async function getHostingPlans(): Promise<HostingPlan[]> {
  return (await getContentBundle()).hostingPlans;
}

export async function getHostingPlan(slug: string): Promise<HostingPlan | undefined> {
  const plans = await getHostingPlans();
  return plans.find((p) => p.slug === slug);
}

export async function getPlansByCategory(category: HostingCategory): Promise<HostingPlan[]> {
  const plans = await getHostingPlans();
  return plans.filter((p) => p.category === category);
}

export async function getPricingPlans(): Promise<PricingEntry[]> {
  return (await getContentBundle()).pricingPlans;
}

export async function getPricingByCategory(category: PricingCategory): Promise<PricingEntry[]> {
  const plans = await getPricingPlans();
  return plans.filter((p) => p.category === category);
}

export async function getAnnualDiscount(): Promise<number> {
  return (await getContentBundle()).pricing.annualDiscount;
}

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  return getCatalogProductRows();
}

export async function getCatalogProduct(id: string): Promise<CatalogProduct | undefined> {
  const products = await getCatalogProducts();
  return products.find((p) => p.id === id);
}

export async function getCatalogForService(slug: string): Promise<CatalogProduct[]> {
  const products = await getCatalogProductRows();
  return products.filter((p) => p.for_services.includes(slug));
}

export async function getCatalogForPricing(name: string): Promise<CatalogProduct | undefined> {
  const products = await getCatalogProductRows();
  return products.find((p) => p.for_pricing.includes(name));
}

export async function getCrossSellRules(): Promise<CrossSellRule[]> {
  return (await getContentBundle()).crossSellRules;
}

export async function getCrossSellOffers(purchased: ProductCategory[], limit = 3): Promise<CrossSellOffer[]> {
  const rules = (await getContentBundle()).crossSellRules;
  const products = await getCatalogProducts();
  const owned = new Set(purchased);
  const offers: CrossSellOffer[] = [];
  const ordered = [...rules].sort((a, b) => a.sort - b.sort);
  for (const rule of ordered) {
    if (offers.length >= limit) break;
    if (!owned.has(rule.trigger)) continue;
    if (owned.has(rule.category)) continue;
    const product =
      (rule.productId ? products.find((p) => p.id === rule.productId) : undefined) ??
      products.find((p) => p.category === rule.category);
    if (!product) continue;
    offers.push({ category: rule.category, productId: product.id, eyebrow: rule.eyebrow, headline: rule.headline, body: rule.body, href: product.href });
  }
  return offers;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return (await getContentBundle()).testimonials;
}

export async function getProposalCatalog(): Promise<ProposalServiceItem[]> {
  return (await getContentBundle()).proposalCatalog;
}