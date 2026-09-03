import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const details: Record<string, { title: string; description: string; items: string[] }> = {
  "design-de-websites": { title: "Design de websites", description: "Uma presença digital clara, rápida e desenhada para fazer o seu negócio avançar.", items: ["Estratégia e arquitectura", "Design responsivo", "SEO técnico e analítica", "Lançamento acompanhado"] },
  "comércio-electrónico": { title: "Comércio electrónico", description: "Uma loja online simples de gerir e agradável de usar, do primeiro clique ao pedido confirmado.", items: ["Catálogo de produtos", "Pagamentos online", "Gestão de pedidos", "Integração com WhatsApp"] },
  "identidade-de-marca": { title: "Identidade de marca", description: "Uma identidade com clareza e personalidade para ser reconhecida onde quer que apareça.", items: ["Posicionamento", "Sistema visual", "Tipografia e cor", "Guia de marca"] },
  "seo-e-conteúdo": { title: "SEO e conteúdo", description: "Conteúdo útil e bases técnicas que ajudam as pessoas certas a encontrar o seu negócio.", items: ["Auditoria técnica", "Pesquisa de palavras-chave", "Estratégia editorial", "Medição de resultados"] },
  "marketing-digital": { title: "Marketing digital", description: "Campanhas focadas que ligam a sua oferta às pessoas certas e transformam atenção em acção.", items: ["Estratégia de campanha", "Redes sociais", "Publicidade digital", "Relatórios claros"] },
  "desenvolvimento-de-software": { title: "Desenvolvimento de software", description: "Plataformas personalizadas, desenhadas à medida da forma como o seu negócio funciona.", items: ["Descoberta e protótipo", "Aplicações web", "Integrações", "Suporte contínuo"] },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = details[decodeURIComponent(slug)];
  return {
    title: `${detail?.title ?? "Soluções digitais"} — IDesign Moz`,
    description: detail?.description,
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = details[decodeURIComponent(slug)] ?? { title: "Soluções digitais", description: "Vamos encontrar a solução certa para o seu próximo passo.", items: ["Estratégia", "Design", "Tecnologia", "Crescimento"] };
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap detail-page"><div className="page-hero"><p className="eyebrow"><span className="pulse" /> Serviço IDesign Moz</p><h1>{detail.title}<br /><em>com propósito.</em></h1><p>{detail.description}</p></div><div className="detail-layout"><div className="detail-list">{detail.items.map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong></div>)}</div><div className="detail-aside"><p>Do primeiro briefing ao lançamento, trabalhamos consigo para criar algo útil, distinto e preparado para crescer.</p><Link className="button" href="/contact">Pedir orçamento <span aria-hidden="true">↗</span></Link></div></div></main><SiteFooter /></div>;
}
