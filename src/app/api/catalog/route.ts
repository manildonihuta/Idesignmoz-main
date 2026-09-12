import { NextResponse } from "next/server";

import { catalog } from "@/services/content.service";

export const dynamic = "force-dynamic";

/**
 * Public catalog for client-side rendering (cart, checkout upsells, hosting/
 * pricing "add to cart" buttons). Serves the DB-backed catalog, cross-sell
 * rules and the annual discount; prices/currencies live in the data only.
 */
export async function GET() {
  const { products, rules, pricingToCatalog, annualDiscount } = await catalog();

  return NextResponse.json(
    { products, rules, pricingToCatalog, annualDiscount },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}