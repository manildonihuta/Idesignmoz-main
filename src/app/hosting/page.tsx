import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Alojamento — IDesign Moz",
  description: "Alojamento web fiável com suporte local, SSL, backups diários e custos transparentes em Moçambique.",
};

const plans = [{ name: "Starter", price: "499", text: "O começo certo", features: ["10 GB SSD", "1 website", "5 contas de email", "SSL gratuito"] }, { name: "Business", price: "999", text: "Espaço para a sua equipa", features: ["30 GB NVMe", "10 websites", "Email ilimitado", "Suporte prioritário"], featured: true }, { name: "Pro", price: "1,999", text: "Potência para o que vem a seguir", features: ["100 GB NVMe", "Websites ilimitados", "Backup avançado", "Suporte prioritário"] }];

export default function HostingPage() {
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap"><div className="page-hero page-hero-split"><div><p className="eyebrow"><span className="pulse" /> Alojamento, sem complicações</p><h1>O seu website<br />merece uma<br /><em>boa casa.</em></h1></div><p>Infra-estrutura fiável, suporte local e custos transparentes. Escolha um plano e avance.</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{plans.map((plan) => <article className={`price-card ${plan.featured ? "featured" : ""}`} key={plan.name}>{plan.featured && <span className="popular">Mais escolhido</span>}<span className="plan-label">{plan.text}</span><h2>{plan.name}</h2><div className="price"><strong>{plan.price}</strong> <span>MT / mês</span></div><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><Link className={plan.featured ? "button" : "outline-button"} href="/contact">Escolher plano <span aria-hidden="true">↗</span></Link></article>)}</div><div className="hosting-note"><span className="status-dot" /> Todos os planos incluem SSL, backups diários e suporte humano em Maputo. <Link href="/contact">Fale connosco <span aria-hidden="true">↗</span></Link></div></main><SiteFooter /></div>;
}
