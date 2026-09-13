import "server-only";

import { cacheDelete, withRedisCache } from "@/lib/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ParsedSection } from "@/lib/ai/builder-schema";

export type PublicSitePage = {
  id: string;
  slug: string;
  title: string;
  navLabel: string;
  sections: ParsedSection[];
};

export type PublicSiteTheme = {
  primaryColor?: string;
  accentColor?: string;
  mode?: "light" | "dark";
  font?: "sans" | "display" | "mono";
};

export type PublicSiteBundle = {
  id: string;
  businessName: string;
  tagline: string | null;
  seo: Record<string, unknown>;
  theme: PublicSiteTheme;
  pages: PublicSitePage[];
};

/* Two-layer cache:
 *   L1 in-process (30s, per lambda) + L2 shared Redis (120s).
 * Invalidation is explicit via `invalidatePublicSite` (called on every write
 * to a site in ai-builder.service). Not-found results are also cached so
 * 404s don't hammer the DB. */
let l1: { bundle: PublicSiteBundle; at: number } | null = null;
const TTL_L1_MS = 30_000;
const TTL_L2_SEC = 120;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toTheme(value: unknown): PublicSiteTheme {
  const theme = asRecord(value);
  return {
    primaryColor: typeof theme.primaryColor === "string" ? theme.primaryColor : undefined,
    accentColor: typeof theme.accentColor === "string" ? theme.accentColor : undefined,
    mode: theme.mode === "light" || theme.mode === "dark" ? theme.mode : undefined,
    font: theme.font === "sans" || theme.font === "display" || theme.font === "mono" ? theme.font : undefined,
  };
}

async function loadPublicSiteFromDb(id: string): Promise<PublicSiteBundle | null> {
  const { data: site } = await supabaseAdmin
    .from("builder_sites")
    .select("id, business_name, tagline, theme, seo, status")
    .eq("id", id)
    .eq("status", "published")
    .single();
  if (!site) return null;

  const { data: pages } = await supabaseAdmin
    .from("builder_pages")
    .select("id, slug, title, nav_label, sort, sections")
    .eq("site_id", id)
    .order("sort", { ascending: true });
  if (!pages?.length) return null;

  return {
    id: site.id,
    businessName: site.business_name,
    tagline: site.tagline,
    seo: asRecord(site.seo),
    theme: toTheme(site.theme),
    pages: pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      navLabel: p.nav_label,
      sections: (p.sections ?? []) as ParsedSection[],
    })),
  };
}

/** Cached published site used by the public renderer (/s/[id]). Null = not
 *  published / not found. */
export async function loadPublicSite(id: string): Promise<PublicSiteBundle | null> {
  if (l1 && l1.bundle.id === id && Date.now() - l1.at < TTL_L1_MS) {
    return l1.bundle;
  }
  const bundle = await withRedisCache<PublicSiteBundle | null>(
    publicSiteCacheKey(id),
    TTL_L2_SEC,
    () => loadPublicSiteFromDb(id),
  );
  if (bundle) {
    l1 = { bundle, at: Date.now() };
  }
  return bundle;
}

/** Drop any cached copy of a published site (site-level or page-level edits). */
export function invalidatePublicSite(id: string): void {
  if (l1 && l1.bundle.id === id) {
    l1 = null;
  }
  void cacheDelete(publicSiteCacheKey(id));
}

function publicSiteCacheKey(id: string): string {
  return `cache:pubsite:v1:${id}`;
}