import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Preços — IDesign Moz",
  description: "Planos de websites, alojamento e domínios com preços claros e transparentes, em Meticais.",
};

const categories = [{ name: "Website inicial", price: "18,500", detail: "Uma base elegante com cinco páginas.", features: ["Design responsivo personalizado", "Domínio + alojamento por 1 ano", "Configuração SEO básica", "Integração com WhatsApp"] }, { name: "Website empresarial", price: "35,000", detail: "Uma presença digital pronta para crescer.", features: ["Até 15 páginas", "Analytics + configuração Google", "Email profissional", "30 dias de suporte"], featured: true }, { name: "Comércio electrónico", price: "Desde 55,000", detail: "Transforme atenção em vendas.", features: ["Configuração da loja online", "Pagamentos + gestão de pedidos", "Catálogo de produtos", "Formação para a sua equipa"] }];

export default function PricingPage() {
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap"><div className="page-hero page-hero-split"><div><p className="eyebrow"><span className="pulse" /> Preços que fazem sentido</p><h1>Invista no<br /><em>próximo passo.</em></h1></div><p>Pontos de partida claros para equipas ambiciosas. Cada projecto é moldado aos seus objectivos.</p></div><div className="pricing-tabs"><span className="active">Websites</span><Link href="/hosting">Alojamento</Link><Link href="/domains">Domínios</Link><Link href="/contact">Marketing</Link></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{categories.map((plan) => <article className={`price-card ${plan.featured ? "featured" : ""}`} key={plan.name}>{plan.featured && <span className="popular">Recomendado</span>}<span className="plan-label">{plan.detail}</span><h2>{plan.name}</h2><div className="price"><strong>{plan.price}</strong> <span>MT pagamento único</span></div><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><Link className={plan.featured ? "button" : "outline-button"} href="/contact">Iniciar conversa <span aria-hidden="true">↗</span></Link></article>)}</div></main><SiteFooter /></div>;
}
