import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getProject } from "@/lib/content";
import PortfolioCaseStudy from "./case-study";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, seo } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(decodeURIComponent(slug));
  if (!project) {
    return { title: "Caso de estudo — IDesign Moz" };
  }
  return seo({
    title: `${project.client} — Caso de estudo IDesign Moz`,
    description: project.summary,
    path: `/portfolio/${project.slug}`,
    keywords: ["caso de estudo", project.client, ...project.services],
  });
}

export default async function CaseStudyWrapper({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const project = await getProject(decoded);
  if (!project) {
    notFound();
  }

  const jsonLd = breadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Portfólio", path: "/portfolio" },
    { name: project.client, path: `/portfolio/${project.slug}` },
  ])

  return (
    <div className="site-shell">
      <SiteHeader />
      <PortfolioCaseStudy project={project} />
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}