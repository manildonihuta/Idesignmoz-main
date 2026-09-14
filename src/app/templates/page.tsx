import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TemplatesGallery } from "@/components/templates-gallery";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Modelos de Design — IDesign Moz",
  description:
    "Começa de um modelo pronto: restaurantes, hotéis, lojas online, portfólios e muito mais. A IDesign AI adapta o modelo ao teu negócio.",
  path: "/templates",
  keywords: ["modelos", "templates", "websites", "IA"],
});

export default function TemplatesPage() {
  return (
    <div className="site-shell">
      <SiteHeader />

      <main className="inner-page">
        <TemplatesGallery />
      </main>

      <SiteFooter />
    </div>
  );
}