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

  const businessSlug = site.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    <div>
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
      {/* Floating IDesign Moz Banner — promotes domain upsell and free builder */}
      <div
        style={{
          position: "fixed",
          bottom: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "rgba(11,12,10,0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(200,255,77,0.2)",
          borderRadius: "2rem",
          padding: "0.5rem 1.25rem",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
        role="banner"
        aria-label="Powered by IDesign Moz"
      >
        <span style={{ fontSize: "0.75rem", color: "#777a72" }}>
          Criado gratuitamente com{" "}
          <a
            href="/"
            style={{ color: "#5227ff", fontWeight: 700, textDecoration: "none" }}
            target="_blank"
            rel="noreferrer"
          >
            IDesign Moz ↗
          </a>
        </span>
        <span style={{ width: 1, height: "1rem", background: "#262925" }} />
        <a
          href={`/domains/search?query=${encodeURIComponent(businessSlug)}.co.mz`}
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#ffffff",
            background: "#5227ff",
            borderRadius: "1rem",
            padding: "0.3rem 0.85rem",
            textDecoration: "none",
          }}
          target="_blank"
          rel="noreferrer"
        >
          Registar domínio .co.mz ↗
        </a>
      </div>
    </div>
  );
}