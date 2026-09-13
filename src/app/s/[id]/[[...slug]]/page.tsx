import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { loadPublicSite } from "@/lib/ai/public-site";
import { SitePage } from "@/components/ai-builder/site-renderer";

export const dynamic = "force-dynamic";

type Params = { id: string; slug?: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id, slug } = await params;
  const pageSlug = slug?.[0] ?? "inicio";

  const site = await loadPublicSite(id);
  if (!site) return {};

  const seo = site.seo;
  const fallbackTitle = site.businessName ?? "Website";
  const title =
    typeof seo.title === "string" && seo.title
      ? seo.title
      : pageSlug === "inicio"
        ? `${fallbackTitle} — Site oficial`
        : fallbackTitle;
  const description =
    typeof seo.description === "string" && seo.description
      ? seo.description
      : typeof site.tagline === "string" && site.tagline
        ? site.tagline
        : "";

  return { title, description };
}

export default async function PublicSitePage({ params }: { params: Promise<Params> }) {
  const { id, slug } = await params;
  const pageSlug = slug?.[0] ?? "inicio";

  const site = await loadPublicSite(id);
  if (!site) notFound();

  const current = site.pages.find((p) => p.slug === pageSlug) ?? (pageSlug === "inicio" ? site.pages[0] : null);
  if (!current) notFound();

  return (
    <SitePage
site={{
          id: site.id,
          businessName: site.businessName,
          tagline: site.tagline ?? "",
          theme: site.theme,
        }}
      pages={site.pages}
      page={current}
    />
  );
}