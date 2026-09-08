import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Sobre — IDesign Moz",
  description:
    "O estúdio por trás da IDesign Moz: tecnologia, design e apoio local para empresas em Moçambique.",
  path: "/about",
  keywords: ["estúdio", "agência em Maputo", "sobre a IDesign Moz"],
});

export default function AboutPage() {
  const jsonLd = breadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Sobre", path: "/about" },
  ])

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero page-hero-split">
          <div>
            <p className="eyebrow">
              <span className="pulse" /> O estúdio
            </p>
            <h1>
              A internet de Moçambique<br />
              <em>merece bons negócios.</em>
            </h1>
          </div>
          <p>
            A IDesign Moz nasceu em Maputo para aproximar as empresas locais
            do que a tecnologia faz melhor: chegar a mais clientes, com menos
            fricção e com custos transparentes.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            ["1", "Suporte local", "Pessoas reais, em Maputo, na sua língua."],
            ["2", "Custos claros", "Preços em Meticais, sem surpresas."],
            ["3", "Feito para crescer", "De um domínio a uma plataforma completa."],
          ].map(([number, title, text]) => (
            <article className="catalog-card" key={number}>
              <span>{number}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="hosting-note">
          <span className="status-dot" /> Uma equipa, um padrão.{" "}
          <Link href="/contact">
            Fale connosco <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </main>
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}