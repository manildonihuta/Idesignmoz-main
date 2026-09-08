import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatMZN } from "@/lib/currency";
import { getHostingPlan } from "@/lib/content";
import { CatalogAddButton } from "@/components/catalog-add-button";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, productSchema, seo } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getHostingPlan(decodeURIComponent(slug));
  if (!plan) {
    return { title: "Alojamento — IDesign Moz" };
  }
  return seo({
    title: `${plan.name} — Alojamento IDesign Moz`,
    description: plan.description,
    path: `/hosting/${plan.slug}`,
    keywords: ["alojamento", "hosting", plan.name],
  });
}

export default async function HostingPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const plan = await getHostingPlan(decodeURIComponent(slug));
  if (!plan) {
    notFound();
  }

  const jsonLd = [
    productSchema({
      name: plan.name,
      description: plan.description,
      url: absoluteUrl(`/hosting/${plan.slug}`),
      price: plan.monthlyPrice,
    }),
    breadcrumbSchema([
      { name: "Início", path: "/" },
      { name: "Alojamento", path: "/hosting" },
      { name: plan.name, path: `/hosting/${plan.slug}` },
    ]),
  ]

  const details = [
    ["Storage", plan.storage],
    ["Websites", plan.websites],
    ["Emails", plan.emails],
    ["Databases", plan.databases],
    ["SSL", plan.ssl],
    ["Backup", plan.backup],
    ["Support", plan.support],
  ];

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap detail-page">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Plano de alojamento
          </p>
          <h1>
            {plan.name}<br />
            <em>com tudo dentro.</em>
          </h1>
          <p>{plan.description}</p>
        </div>
        <div className="detail-layout">
          <div className="detail-list">
            {details.map(([label, value], index) => (
              <div key={label}>
                <span>0{index + 1}</span>
                <div>
                  <strong>{value}</strong>
                  <small className="block text-muted" style={{ fontSize: 12 }}>
                    {label}
                  </small>
                </div>
              </div>
            ))}
          </div>
          <div className="detail-aside">
            <div className="price">
              <strong>{formatMZN(plan.monthlyPrice)}</strong> <span>MT / mês</span>
            </div>
            <p className="text-sm">
              {formatMZN(plan.annualPrice)} MT / ano — pague antecipado e poupe.
            </p>
            <p>
              Todos os planos incluem SSL, backups e suporte humano em
              Maputo.
            </p>
            <CatalogAddButton productId={`hosting-${plan.slug}`} />
            <Link className="outline-button" href="/contact">
              Pedir orçamento <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}