import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import PricingMarketplace from "./pricing-marketplace";
import { JsonLd } from "@/components/json-ld";
import { getAnnualDiscount, getCatalogProductRows, getPricingPlans } from "@/lib/content";
import { PRICING_CATEGORIES } from "@/lib/pricing-plans";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, itemListSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Preços — IDesign Moz",
  description: "Planos de websites, alojamento, domínios, marketing e manutenção com preços claros e transparentes, em Meticais.",
  path: "/pricing",
  keywords: ["preços", "planos", "websites", "alojamento", "domínios", "meticais"],
});

export default async function PricingPage() {
  const [plans, products, annualDiscount] = await Promise.all([
    getPricingPlans(),
    getCatalogProductRows(),
    getAnnualDiscount(),
  ]);

  const categories = PRICING_CATEGORIES.filter((category) =>
    plans.some((plan) => plan.category === category),
  );

  const pricingToCatalog: Record<string, string> = {};
  for (const plan of plans) {
    const product = products.find((p) => p.for_pricing.includes(plan.name));
    if (product) pricingToCatalog[plan.name] = product.id;
  }

  const jsonLd = [
    itemListSchema(
      plans.map((plan) => ({
        name: plan.name,
        url: absoluteUrl(plan.href),
      })),
      {
        name: "Preços IDesign Moz",
        description: "Planos de websites, alojamento, domínios, marketing e manutenção.",
        url: absoluteUrl("/pricing"),
      },
    ),
    breadcrumbSchema([
      { name: "Início", path: "/" },
      { name: "Preços", path: "/pricing" },
    ]),
  ]

  return (
    <div className="site-shell">
      <SiteHeader />
      <PricingMarketplace
        plans={plans}
        categories={categories}
        annualDiscount={annualDiscount}
        pricingToCatalog={pricingToCatalog}
      />
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}