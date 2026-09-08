import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import PortfolioGrid from "./portfolio-grid";
import { JsonLd } from "@/components/json-ld";
import { getProjects } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, itemListSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Portfólio — IDesign Moz",
  description: "Projectos seleccionados de websites, marcas, apps e comércio electrónico feitos em Moçambique para o mundo.",
  path: "/portfolio",
  keywords: ["portfólio", "casos de estudo", "websites", "projetos"],
});

export default async function PortfolioPage() {
  const projects = await getProjects();
  const jsonLd = [
    itemListSchema(
      projects.map((project) => ({
        name: `${project.client} — ${project.summary}`,
        url: absoluteUrl(`/portfolio/${project.slug}`),
      })),
      {
        name: "Portfólio IDesign Moz",
        description: "Projectos seleccionados de websites, marcas, apps e comércio electrónico.",
        url: absoluteUrl("/portfolio"),
      },
    ),
    breadcrumbSchema([
      { name: "Início", path: "/" },
      { name: "Portfólio", path: "/portfolio" },
    ]),
  ]

  return (
    <div className="site-shell">
      <SiteHeader />
      <PortfolioGrid projects={projects} />
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}