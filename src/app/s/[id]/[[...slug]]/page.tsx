import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { SitePage } from "@/components/ai-builder/site-renderer";
import type { ParsedSection } from "@/lib/ai/builder-schema";

export const dynamic = "force-dynamic";

type Params = { id: string; slug?: string[] };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asTheme(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id, slug } = await params;
  const pageSlug = slug?.[0] ?? "inicio";

  const { data: site } = await supabaseAdmin
    .from("builder_sites")
    .select("business_name, tagline, seo")
    .eq("id", id)
    .eq("status", "published")
    .single();

  const seo = asRecord(site?.seo);
  const fallbackTitle = site?.business_name ?? "Website";
  const title = typeof seo.title === "string" && seo.title ? seo.title : pageSlug === "inicio" ? `${fallbackTitle} — Site oficial` : fallbackTitle;
  const description =
    typeof seo.description === "string" && seo.description
      ? seo.description
      : typeof site?.tagline === "string" && site.tagline
        ? site.tagline
        : "";

  return { title, description };
}

export default async function PublicSitePage({ params }: { params: Promise<Params> }) {
  const { id, slug } = await params;
  const pageSlug = slug?.[0] ?? "inicio";

  const { data: site } = await supabaseAdmin
    .from("builder_sites")
    .select("id, business_name, tagline, theme, status")
    .eq("id", id)
    .eq("status", "published")
    .single();
  if (!site) notFound();

  const { data: pages } = await supabaseAdmin
    .from("builder_pages")
    .select("id, slug, title, nav_label, sort, sections")
    .eq("site_id", id)
    .order("sort", { ascending: true });

  if (!pages?.length) notFound();

  const theme = asTheme(site.theme);
  const current = pages.find((p) => p.slug === pageSlug) ?? (pageSlug === "inicio" ? pages[0] : null);
  if (!current) notFound();

  return (
    <SitePage
      site={{
        id: site.id,
        businessName: site.business_name,
        tagline: site.tagline,
        theme: {
          primaryColor: typeof theme.primaryColor === "string" ? theme.primaryColor : undefined,
          accentColor: typeof theme.accentColor === "string" ? theme.accentColor : undefined,
          mode: theme.mode === "light" || theme.mode === "dark" ? theme.mode : undefined,
          font: theme.font === "sans" || theme.font === "display" || theme.font === "mono" ? theme.font : undefined,
        },
      }}
      pages={pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        navLabel: p.nav_label,
        sections: (p.sections ?? []) as ParsedSection[],
      }))}
      page={{
        id: current.id,
        slug: current.slug,
        title: current.title,
        navLabel: current.nav_label,
        sections: (current.sections ?? []) as ParsedSection[],
      }}
    />
  );
}