import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { SERVICES, type Service } from "../src/lib/services";
import { BLOG_CATEGORIES, posts } from "../src/lib/blog";
import { PROJECTS } from "../src/lib/portfolio";
import { HOSTING_PLANS } from "../src/lib/hosting-plans";
import { PRICING_PLANS, ANNUAL_DISCOUNT } from "../src/lib/pricing-plans";
import {
  CATALOG,
  CROSS_SELL_RULES,
  SERVICE_TO_CATALOG,
  PRICING_TO_CATALOG,
  defaultProductIdForCategory,
  type CatalogProduct,
  type ProductCategory,
} from "../src/lib/catalog";
import { SERVICE_CATALOG } from "../src/lib/proposals";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/\\"/g, '"');
      }
      out[m[1]] = val;
    }
  } catch {
    /* .env.local not present */
  }
  return out;
}

type CatalogProductRow = CatalogProduct & { for_services: string[]; for_pricing: string[] };
type CrossSellRuleRow = {
  trigger: ProductCategory;
  category: ProductCategory;
  productId?: string;
  eyebrow: string;
  headline: string;
  body: string;
  sort: number;
};

function buildCatalogRows(): CatalogProductRow[] {
  const productToServices = new Map<string, string[]>();
  for (const [slug, ids] of Object.entries(SERVICE_TO_CATALOG)) {
    for (const id of ids) {
      const current = productToServices.get(id) ?? [];
      current.push(slug);
      productToServices.set(id, current);
    }
  }
  const productToPlans = new Map<string, string[]>();
  for (const [name, id] of Object.entries(PRICING_TO_CATALOG)) {
    const current = productToPlans.get(id) ?? [];
    current.push(name);
    productToPlans.set(id, current);
  }
  return CATALOG.map((p) => ({
    ...p,
    for_services: productToServices.get(p.id) ?? [],
    for_pricing: productToPlans.get(p.id) ?? [],
  }));
}

function buildCrossSellRows(): CrossSellRuleRow[] {
  return (Object.keys(CROSS_SELL_RULES) as ProductCategory[]).flatMap((trigger) =>
    CROSS_SELL_RULES[trigger].map((rule, index) => ({
      trigger,
      category: rule.category,
      productId: defaultProductIdForCategory(rule.category),
      eyebrow: rule.eyebrow,
      headline: rule.headline,
      body: rule.body,
      sort: index,
    })),
  );
}

const testimonials = [
  {
    quote: "A equipa percebeu o nosso negócio no primeiro dia. O site ficou rápido e bonito, e as vendas seguiram o mesmo caminho.",
    name: "Marta Chongo",
    role: "Directora · Amplius Consulting",
  },
  {
    quote: "Deixámos de depender do Facebook para vender. A loja online paga-se a si própria todos os meses.",
    name: "Kelvin Nhassengo",
    role: "Fundador · Kaya Colectivo",
  },
  {
    quote: "Suporte directo, em português, mesmo aos fins-de-semana. É outra experiência.",
    name: "Dr. Elias Macuacua",
    role: "Clínica Polana",
  },
];

describe("seed-content", () => {
  it("should push all content to site_settings", async () => {
    const env = loadEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    }
    const supabase = createClient(url, key);

    const payload: Array<{ key: string; value: unknown }> = [
      { key: "services", value: SERVICES },
      { key: "blog_categories", value: BLOG_CATEGORIES },
      { key: "blog_posts", value: posts },
      { key: "portfolio_projects", value: PROJECTS },
      { key: "hosting_plans", value: HOSTING_PLANS },
      { key: "pricing_plans", value: PRICING_PLANS },
      { key: "pricing", value: { annualDiscount: ANNUAL_DISCOUNT } },
      { key: "catalog_products", value: buildCatalogRows() },
      { key: "cross_sell_rules", value: buildCrossSellRows() },
      { key: "proposal_catalog", value: SERVICE_CATALOG },
      { key: "testimonials", value: testimonials },
    ];

    for (const row of payload) {
      const { error } = await supabase.from("site_settings").upsert(row, { onConflict: "key" });
      if (error) throw new Error(`${row.key}: ${error.message}`);
    }

    // Buyable catalog also lives relationally (P4) — keep both in sync.
    const catalogRows = buildCatalogRows();
    const { error: catalogError } = await supabase
      .from("catalog_products")
      .upsert(
        catalogRows.map((p, index) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          type: p.type,
          price: p.price,
          annual_price: p.annualPrice ?? null,
          currency: p.currency ?? "MZN",
          description: p.description,
          features: p.features ?? [],
          href: p.href,
          icon: p.icon ?? null,
          meta: (p.meta ?? null) as Record<string, unknown> | null,
          for_services: p.for_services,
          for_pricing: p.for_pricing,
          active: true,
          sort: index,
        })),
        { onConflict: "id" },
      );
    if (catalogError) throw new Error(`catalog_products: ${catalogError.message}`);

    const counts: Record<string, number> = {
      services: (SERVICES as Service[]).length,
      blog_categories: BLOG_CATEGORIES.length,
      blog_posts: posts.length,
      portfolio_projects: PROJECTS.length,
      hosting_plans: HOSTING_PLANS.length,
      pricing_plans: PRICING_PLANS.length,
      catalog_products: buildCatalogRows().length,
      proposal_catalog: SERVICE_CATALOG.length,
    };

    const { data, error } = await supabase.from("site_settings").select("key, value");
    if (error) throw new Error(`read-back: ${error.message}`);
    const readBack = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    for (const [keyName, expected] of Object.entries(counts)) {
      const actual: unknown[] = readBack[keyName] ?? [];
      expect(actual.length, `${keyName} rows`).toBe(expected);
    }
    expect((readBack.testimonials ?? []).length).toBe(3);
    expect(readBack.pricing).toEqual({ annualDiscount: ANNUAL_DISCOUNT });

    const { data: relRows, error: relError } = await supabase
      .from("catalog_products")
      .select("id");
    if (relError) throw new Error(`catalog_products read-back: ${relError.message}`);
    expect(relRows?.length).toBe(catalogRows.length);
  });
});