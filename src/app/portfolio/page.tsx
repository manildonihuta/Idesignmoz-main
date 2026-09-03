import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Portfólio — IDesign Moz",
  description: "Projectos seleccionados de websites, marcas e comércio electrónico feitos em Moçambique para o mundo.",
};

const work = [{ title: "Castel Branco", type: "Hotelaria", year: "2024", className: "coastal" }, { title: "Kaya", type: "Cultura e comércio", year: "2023", className: "editorial" }, { title: "Numa", type: "Tecnologia", year: "2024", className: "numa" }];

export default function PortfolioPage() {
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap"><div className="page-hero"><p className="eyebrow"><span className="pulse" /> Trabalhos seleccionados</p><h1>Bom trabalho<br />vai <em>longe.</em></h1><p>Projectos para pessoas e empresas a deixar a sua marca, de Moçambique para o mundo.</p></div><div className="filter-row"><span>Todos os trabalhos</span><Link href="/portfolio">Todos</Link><Link href="/portfolio">Websites</Link><Link href="/portfolio">Marcas</Link><Link href="/portfolio">Comércio electrónico</Link></div><div className="portfolio-grid">{work.map((item) => <article className="portfolio-item" key={item.title}><div className={`portfolio-art ${item.className}`}><span>{item.year}</span>{item.className === "editorial" && <b>Kaya</b>}{item.className === "numa" && <b>Numa<br /><i>systems</i></b>}</div><div className="portfolio-meta"><div><h2>{item.title}</h2><p>{item.type}</p></div><Link href="/contact" aria-label={`Ver projecto ${item.title}`}>↗</Link></div></article>)}</div></main><SiteFooter /></div>;
}
