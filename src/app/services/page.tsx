import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Serviços — IDesign Moz",
  description: "Design de websites, comércio electrónico, identidade de marca, SEO, marketing digital e desenvolvimento de software em Moçambique.",
};

const services = [
  ["01", "Design de websites", "Presenças digitais com uma visão clara e um caminho simples para a acção."],
  ["02", "Comércio electrónico", "Experiências de compra que tornam fácil descobrir, confiar e comprar."],
  ["03", "Identidade de marca", "Uma linguagem visual distinta para empresas prontas para serem reconhecidas."],
  ["04", "SEO e conteúdo", "Conteúdo útil e bases técnicas que conquistam atenção ao longo do tempo."],
  ["05", "Marketing digital", "Campanhas focadas que ligam a sua oferta às pessoas certas."],
  ["06", "Desenvolvimento de software", "Plataformas personalizadas, desenhadas à medida do seu negócio."],
];

export default function ServicesPage() {
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap"><div className="page-hero"><p className="eyebrow"><span className="pulse" /> A próxima decisão digital</p><h1>Serviços com<br /><em>substância.</em></h1><p>Estratégia, design e tecnologia para empresas a construir o seu próximo capítulo.</p></div><div className="section-kicker"><span>01</span><span className="rule" /><span>Explore o estúdio</span></div><div className="catalog-grid">{services.map(([number, title, text]) => <Link className="catalog-card" href={`/services/${title.toLowerCase().replaceAll(" ", "-")}`} key={number}><span>{number}</span><h2>{title}</h2><p>{text}</p><b>Explorar <span aria-hidden="true">↗</span></b></Link>)}</div></main><SiteFooter /></div>;
}
