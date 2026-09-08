export type ServiceCategory =
  | "Web"
  | "Branding"
  | "Marketing"
  | "SEO"
  | "Software"
  | "Design";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "Web",
  "Branding",
  "Marketing",
  "SEO",
  "Software",
  "Design",
];

export type ServiceFaq = { question: string; answer: string };
export type ServicePricingTier = { name: string; price: string; period?: string; features: string[] };

export type Service = {
  slug: string;
  name: string;
  title: string;
  category: ServiceCategory;
  description: string;
  hero: string;
  intro: string;
  features: string[];
  process: Array<{ step: string; title: string; text: string }>;
  deliverables: string[];
  technologies: string[];
  portfolioSlugs?: string[];
  pricing: Array<{
    tier: ServicePricingTier;
    note?: string;
  }>;
  faqs: ServiceFaq[];
  ctaLabel: string;
};

export const SERVICES: Service[] = [
  {
    slug: "web-development",
    name: "Website Design",
    title: "Website Design",
    category: "Web",
    description: "Modern websites designed for businesses that want to grow.",
    hero: "Elevate your presence with websites built for growth.",
    intro:
      "A modern website is the fastest way to earn trust and turn visitors into customers. We design and build fast, responsive, and conversion-focused sites tailored to your business.",
    features: [
      "Responsive design",
      "Fast performance",
      "Conversion-focused layout",
      "Clean, scalable code",
      "SEO-friendly structure",
      "Ongoing support",
    ],
    process: [
      { step: "01", title: "Discovery", text: "Entendemos o seu negócio, público e objectivos." },
      { step: "02", title: "Design", text: "Estrutura, interface e identidade visual definidos." },
      { step: "03", title: "Development", text: "Construímos o website com as melhores práticas." },
      { step: "04", title: "Launch", text: "Testes, lançamento e acompanhamento inicial." },
    ],
    deliverables: [
      "Wireframes & mockups",
      "Responsive website",
      "CMS / painel de gestão",
      "SEO técnico",
      "Formação de equipa",
    ],
    technologies: ["Next.js", "React", "Tailwind CSS", "Node.js", "PostgreSQL", "Vercel"],
    pricing: [
      {
        tier: { name: "Starter Website", price: "25,000 MT", period: "pagamento único", features: ["domínio", "hosting", "até 5 páginas", "responsive design", "SSL", "WhatsApp", "contact form", "basic SEO"] },
        note: "Perfeito para quem quer começar online com um website profissional e completo.",
      },
      {
        tier: { name: "Business Website", price: "55,000 MT", period: "pagamento único", features: ["domínio", "hosting", "até 15 páginas", "custom design", "SEO", "analytics", "Google integration", "professional email"] },
        note: "Para negócios que querem uma presença digital forte e crescimento medido.",
      },
    ],
    faqs: [
      { question: "Quanto tempo demora a criar um website?", answer: "Em média 2 a 4 semanas, dependendo da complexidade e do número de páginas." },
      { question: "O site funciona no telemóvel?", answer: "Sim, todos os sites que criamos são totalmente responsivos e funcionam em qualquer ecrã." },
      { question: "Fica fácil actualizar o conteúdo?", answer: "Sim, entregamos um CMS simples para editar textos, imagens e produtos sem programar." },
    ],
    ctaLabel: "Start Project",
  },
  {
    slug: "e-commerce",
    name: "E-commerce",
    title: "E-commerce",
    category: "Web",
    description: "Launch your online store with powerful commerce tools.",
    hero: "Sell online with a store your customers will love.",
    intro:
      "Transforme o seu catálogo numa loja online completa, com pagamentos integrados, gestão de pedidos e ferramentas para crescer.",
    features: ["Online store", "Products & categories", "Payments", "Order management", "WhatsApp", "Analytics & SEO"],
    process: [
      { step: "01", title: "Planeamento", text: "Catálogo, pagamentos e fluxo de compra definidos." },
      { step: "02", title: "Design da loja", text: "Interface de compra clara e agradável." },
      { step: "03", title: "Configuração", text: "Produtos, categorias, pagamentos e envios." },
      { step: "04", title: "Lançamento", text: "Testes completos e acompanhamento do arranque." },
    ],
    deliverables: ["Loja online", "Catálogo & categorias", "Pagamentos online", "Gestão de pedidos", "Integração WhatsApp"],
    technologies: ["Next.js", "React", "Stripe / M-Pesa", "Tailwind CSS", "PostgreSQL", "Vercel"],
    pricing: [
      {
        tier: { name: "E-commerce", price: "85,000 MT", period: "pagamento único", features: ["domain", "hosting", "online store", "products", "categories", "payments", "WhatsApp", "order management", "analytics", "SEO"] },
        note: "A solução completa para vender online com tudo incluído.",
      },
    ],
    faqs: [
      { question: "Que pagamentos aceitam?", answer: "Integramos M-Pesa e cartões de crédito, conforme o seu plano de negócios." },
      { question: "Consigo gerir os pedidos?", answer: "Sim, incluímos um painel de gestão de pedidos, produtos e categorias." },
      { question: "É possível vender no WhatsApp?", answer: "Sim, integramos WhatsApp para receber e confirmar encomendas." },
    ],
    ctaLabel: "Start Project",
  },
  {
    slug: "branding",
    name: "Branding",
    title: "Branding",
    category: "Branding",
    description: "Build a recognizable and professional brand.",
    hero: "Craft a brand people remember and trust.",
    intro:
      "Uma marca consistente torna o seu negócio reconhecível. Criamos identidades completas que comunicam quem é e o que oferece.",
    features: ["Brand strategy", "Logo & identity", "Visual system", "Brand guidelines", "Tone of voice"],
    process: [
      { step: "01", title: "Descoberta", text: "Mergulhamos no seu mercado e nos seus objectivos." },
      { step: "02", title: "Estratégia", text: "Posicionamento, personalidade e mensagem central." },
      { step: "03", title: "Identidade", text: "Logo, cor, tipografia e elementos visuais." },
      { step: "04", title: "Guia", text: "Entregamos as directrizes para uso consistente." },
    ],
    deliverables: ["Posicionamento", "Logo & sistema visual", "Tipografia & cor", "Guia de marca"],
    technologies: ["Figma", "Illustrator", "Brand strategy", "Tone of voice"],
    portfolioSlugs: ["kaya"],
    pricing: [
      {
        tier: { name: "Brand Essentials", price: "30,000 MT", features: ["logo", "paleta de cor", "tipografia", "cartões de visita", "guia básico"] },
      },
      {
        tier: { name: "Brand Identity", price: "60,000 MT", features: ["tudo do Essentials", "estratégia", "sistema visual completo", "guia de marca", "mockups de aplicação"] },
        note: "Recomendado para marcas que querem destacar-se.",
      },
    ],
    faqs: [
      { question: "O que está incluído no logo?", answer: "Várias propostas, refinamento e os ficheiros finais em todos os formatos necessários." },
      { question: "Fazem rebranding?", answer: "Sim, ajudamos marcas existentes a renovar a identidade mantendo o que funciona." },
    ],
    ctaLabel: "Request Quote",
  },
  {
    slug: "seo",
    name: "SEO",
    title: "SEO",
    category: "SEO",
    description: "Improve your visibility and reach more customers.",
    hero: "Get found by the people searching for you.",
    intro:
      "Otimizamos o seu website para aparecer nos resultados de pesquisa e atrair tráfego qualificado, mês após mês.",
    features: ["Keyword research", "Technical SEO", "On-page optimization", "Content strategy", "Analytics & reporting"],
    process: [
      { step: "01", title: "Auditoria", text: "Análise técnica e de conteúdo completa." },
      { step: "02", title: "Estratégia", text: "Palavras-chave e plano editorial definidos." },
      { step: "03", title: "Otimização", text: "Correções técnicas e melhorias de página." },
      { step: "04", title: "Reporte", text: "Medição contínua e relatórios claros." },
    ],
    deliverables: ["Auditoria técnica", "Pesquisa de palavras-chave", "Otimização on-page", "Relatórios mensais"],
    technologies: ["Google Search Console", "Google Analytics", "Ahrefs", "Screaming Frog"],
    pricing: [
      {
        tier: { name: "SEO", price: "12,000 MT", period: "/ mês", features: ["auditoria técnica", "palavras-chave", "otimização on-page", "conteúdo", "relatórios"] },
      },
    ],
    faqs: [
      { question: "Quanto tempo até ver resultados?", answer: "Normalmente 2 a 4 meses para melhorias visíveis na classificação." },
      { question: "Posso ver o progresso?", answer: "Sim, enviamos relatórios mensais com as métricas mais importantes." },
    ],
    ctaLabel: "Request Quote",
  },
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    title: "Digital Marketing",
    category: "Marketing",
    description: "Reach the right audience and turn traffic into customers.",
    hero: "Reach the right people and turn clicks into customers.",
    intro:
      "Campanhas estratégicas de redes sociais e publicidade digital que conectam a sua oferta às pessoas certas.",
    features: ["Social media", "Paid ads", "Content strategy", "Email marketing", "Analytics & reporting"],
    process: [
      { step: "01", title: "Estratégia", text: "Público, canais e objectivos definidos." },
      { step: "02", title: "Conteúdo", text: "Criação de peças para redes sociais." },
      { step: "03", title: "Campanha", text: "Publicidade digital com segmentação." },
      { step: "04", title: "Optimização", text: "Ajustes contínuos e relatórios." },
    ],
    deliverables: ["Estratégia de campanha", "Redes sociais", "Publicidade digital", "Relatórios"],
    technologies: ["Meta Ads", "Google Ads", "Hootsuite", "Canva"],
    pricing: [
      {
        tier: { name: "Digital Marketing", price: "15,000 MT", period: "/ mês", features: ["gestão de redes", "conteúdo", "campanhas pagas", "relatórios"] },
      },
    ],
    faqs: [
      { question: "Qual o orçamento mínimo?", answer: "Os pacotes mensais começam nos 15,000 MT incluindo gestão e conteúdo." },
      { question: "Qual a plataforma ideal?", answer: "Depende do seu público — fazemos a escolha após análise." },
    ],
    ctaLabel: "Request Quote",
  },
  {
    slug: "software-development",
    name: "Software Development",
    title: "Software Development",
    category: "Software",
    description: "Custom platforms built around your business.",
    hero: "Build custom software that fits how you work.",
    intro:
      "Desenvolvemos plataformas e aplicações web personalizadas, construídas à medida da forma como o seu negócio funciona.",
    features: ["Custom web apps", "Integrations", "APIs", "Databases", "Cloud deployment", "Ongoing support"],
    process: [
      { step: "01", title: "Discovery", text: "Requisitos e objectivos claramente definidos." },
      { step: "02", title: "Protótipo", text: "Maquete interativa para validar a solução." },
      { step: "03", title: "Desenvolvimento", text: "Construção com testes ao longo do caminho." },
      { step: "04", title: "Entrega", text: "Deploy, documentação e suporte." },
    ],
    deliverables: ["Aplicação web", "APIs & integrações", "Base de dados", "Documentação", "Suporte contínuo"],
    technologies: ["Next.js", "React", "Node.js", "PostgreSQL", "TypeScript", "AWS"],
    pricing: [
      {
        tier: { name: "Software Development", price: "Sob orçamento", features: ["descoberta", "protótipo", "desenvolvimento", "integrações", "suporte"] },
        note: "O custo depende do âmbito. Agende uma conversa para estimarmos.",
      },
    ],
    faqs: [
      { question: "Como funciona o orçamento?", answer: "Começamos com uma descoberta para definir o âmbito e só depois apresentamos o orçamento." },
      { question: "Vocês mantêm o software depois?", answer: "Sim, oferecemos planos de suporte e evolução contínua." },
    ],
    ctaLabel: "Request Quote",
  },
];

export const SERVICES_BY_SLUG: Record<string, Service> = Object.fromEntries(
  SERVICES.map((s) => [s.slug, s]),
);

export function getServicesByCategory(category: ServiceCategory | "All"): Service[] {
  if (category === "All") return SERVICES;
  return SERVICES.filter((s) => s.category === category);
}
