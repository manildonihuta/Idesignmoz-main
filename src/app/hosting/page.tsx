import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import HostingMarketplace from "./marketplace";
import { JsonLd } from "@/components/json-ld";
import { getHostingPlans } from "@/lib/content";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/hosting-plans";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, productSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Alojamento — IDesign Moz",
  description: "Alojamento web fiável com suporte local, SSL, backups diários e custos transparentes em Moçambique.",
  path: "/hosting",
  keywords: ["alojamento web", "hosting", "servidor", "Moçambique", "SSL"],
});

export default async function HostingPage() {
  const plans = await getHostingPlans();
  const categories = CATEGORY_ORDER.filter((category) =>
    plans.some((p) => p.category === category),
  ).map((category) => ({ slug: category, label: CATEGORY_LABELS[category] }));

  const jsonLd = [
    ...plans.map((plan) =>
      productSchema({
        name: plan.name,
        description: plan.description,
        url: absoluteUrl(`/hosting/${plan.slug}`),
        price: plan.monthlyPrice,
      }),
    ),
    breadcrumbSchema([
      { name: "Início", path: "/" },
      { name: "Alojamento", path: "/hosting" },
    ]),
  ]

  return (
    <div className="site-shell">
      <SiteHeader />
      <HostingMarketplace plans={plans} categories={categories} />
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}