import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getService, getCatalogForService } from "@/lib/content";
import ServiceDetailPage from "./service-detail";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, faqSchema, seo, serviceSchema } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(decodeURIComponent(slug));
  if (!service) {
    return { title: "Serviço — IDesign Moz" };
  }
  return seo({
    title: `${service.title} — IDesign Moz`,
    description: service.description,
    path: `/services/${service.slug}`,
    keywords: [service.name, service.category, "serviços digitais"],
  });
}

export default async function ServiceDetailWrapper({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const service = await getService(decoded);
  if (!service) {
    notFound();
  }

  const cartableProducts = await getCatalogForService(decoded);

  const jsonLd = [
    serviceSchema({
      name: service.name,
      description: service.description,
      url: absoluteUrl(`/services/${service.slug}`),
    }),
    faqSchema(service.faqs),
    breadcrumbSchema([
      { name: "Início", path: "/" },
      { name: "Serviços", path: "/services" },
      { name: service.name, path: `/services/${service.slug}` },
    ]),
  ]

  return (
    <div className="site-shell">
      <SiteHeader />
      <ServiceDetailPage service={service} cartableProducts={cartableProducts} />
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}