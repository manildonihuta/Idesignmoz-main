import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import DomainSearch from "@/components/domain-search";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Pesquisa de domínios — IDesign Moz",
  description:
    "Encontre domínios disponíveis para o seu negócio, com preços em Meticais.",
  path: "/domains/search",
});

export default function DomainsSearchPage() {
  const jsonLd = breadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Domínios", path: "/domains" },
    { name: "Pesquisa de domínios", path: "/domains/search" },
  ])

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Pesquisa de domínios
          </p>
          <h1>
            O nome perfeito<br />
            <em>está aqui perto.</em>
          </h1>
          <p>
            Verifique disponibilidade, preço e renovação em tempo real — e
            adicione ao carrinho em um clique.
          </p>
        </div>
        <DomainSearch />
      </main>
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}