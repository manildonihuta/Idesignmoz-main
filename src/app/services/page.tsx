import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import ServicesMarketplace from "./marketplace";
import { JsonLd } from "@/components/json-ld";
import { getServices } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, itemListSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Serviços — IDesign Moz",
  description: "Design de websites, comércio electrónico, identidade de marca, SEO, marketing digital e desenvolvimento de software em Moçambique.",
  path: "/services",
  keywords: [
    "serviços web",
    "criar website",
    "loja online",
    "identidade de marca",
    "SEO",
  ],
});

export default async function ServicesPage() {
  const services = await getServices();
  const jsonLd = [
    itemListSchema(
      services.map((service) => ({
        name: service.name,
        url: absoluteUrl(`/services/${service.slug}`),
      })),
      {
        name: "Serviços IDesign Moz",
        description: "Serviços digitais para negócios em Moçambique.",
        url: absoluteUrl("/services"),
      },
    ),
    breadcrumbSchema([
      { name: "Início", path: "/" },
      { name: "Serviços", path: "/services" },
    ]),
  ]

  return (
    <div className="site-shell">
      <SiteHeader />
      <ServicesMarketplace services={services} />
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}