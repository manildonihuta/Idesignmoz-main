import { NextResponse } from "next/server";

import { getCatalogProductRows, getCrossSellRules, getAnnualDiscount } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Public catalog for client-side rendering (cart, checkout upsells, hosting/
 * pricing "add to cart" buttons). Serves the DB-backed catalog, cross-sell
 * rules and the annual discount; prices/currencies live in the data only.
 */
export async function GET() {
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

  return NextResponse.json(
    { products, rules, pricingToCatalog, annualDiscount },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}