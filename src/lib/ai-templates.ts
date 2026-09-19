/* AI Builder — template catalogue (static data, no DB yet). */

export type AiTemplateImages = {
  hero?: string;
  about?: string;
  gallery: string[];
};

export type AiTemplate = {
  id: string;
  name: string;
  industry: string;
  industryLabel: string;
  description: string;
  style: string;
  colors: { from: string; to: string; accent: string };
  pages: number;
  brief: string;
  images: AiTemplateImages;
};

export const AI_TEMPLATES: AiTemplate[] = [
  {
    id: "restaurante",
    name: "Sabor & Tradição",
    industry: "Restaurante e alimentação",
    industryLabel: "🍽️ Restaurante",
    description:
      "Cozinha moçambicana em destaque: menu, especialidades, reservas, horários e localização com o calor de um estabelecimento familiar.",
    style: "modern",
    colors: { from: "#E31E24", to: "#FF5A5F", accent: "#7C3AED" },
    pages: 4,
    brief:
      "Restaurante de cozinha moçambicana com ambiente familiar. Destacar o menu, especialidades, reservas, horários e localização.",
    images: {
      hero: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "hotel-boutique",
    name: "Mar Azul",
    industry: "Hotel e alojamento",
    industryLabel: "🏨 Hotel",
    description:
      "Um hotel boutique virado para a praia: quartos, experiências, preços e reserva. Elegante, sóbrio e acolhedor.",
    style: "elegant",
    colors: { from: "#0E7C7B", to: "#1FB6A6", accent: "#F5B942" },
    pages: 4,
    brief:
      "Hotel boutique com quartos virados para a praia. Apresentar quartos, experiências, preços e formulário de reserva.",
    images: {
      hero: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "portfolio-criativo",
    name: "Estúdio K",
    industry: "Portfólio",
    industryLabel: "🎨 Portfólio",
    description:
      "Portfólio de designer ou fotógrafo: projetos seleccionados, serviços e contacto. Tipografia forte e presença marcante.",
    style: "bold",
    colors: { from: "#7C3AED", to: "#FF5A5F", accent: "#22D3EE" },
    pages: 3,
    brief:
      "Portfólio de designer criativo. Apresentar projetos seleccionados, serviços e um formulário de contacto claro.",
    images: {
      hero: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1550439062-609e1531270e?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "agencia",
    name: "Cresce & Co",
    industry: "Empresa / serviços",
    industryLabel: "💼 Negócio",
    description:
      "Escritório de serviços profissionais: apresentação, equipa, serviços e contactos. Limpo, de confiança e direto.",
    style: "minimal",
    colors: { from: "#111827", to: "#4B5563", accent: "#5227ff" },
    pages: 4,
    brief:
      "Consultoria de negócios para PME. Destacar serviços, vantagens, casos de sucesso e contacto para reunião.",
    images: {
      hero: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "loja-online",
    name: "Kiva Store",
    industry: "Loja online",
    industryLabel: "🛍️ Loja online",
    description:
      "Loja online de artesanato: catálogo, categorias, promoções e uma página dedicada a vender. Vibrante e convidativo.",
    style: "playful",
    colors: { from: "#F59E0B", to: "#FF5A5F", accent: "#7C3AED" },
    pages: 5,
    brief:
      "Loja online de artesanato moçambicano. Mostrar catálogo, categorias e uma página dedicada a vender com entrega nacional.",
    images: {
      hero: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "imobiliaria",
    name: "Casa MZ",
    industry: "Imobiliário",
    industryLabel: "🏡 Imobiliário",
    description:
      "Imobiliária que inspira confiança: imóveis em destaque, zonas de Maputo, serviços e contactos para visitas.",
    style: "modern",
    colors: { from: "#065F46", to: "#10B981", accent: "#F5B942" },
    pages: 4,
    brief:
      "Imobiliária em Maputo para venda e arrendamento. Destacar imóveis disponíveis, zonas e contactos para visitas.",
    images: {
      hero: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "salao-beleza",
    name: "Bela & Co",
    industry: "Outro",
    industryLabel: "✨ Outro",
    description:
      "Salão de beleza e estética: serviços, preços, marcas e marcação online. Feminino, elegante e moderno.",
    style: "elegant",
    colors: { from: "#DB2777", to: "#F472B6", accent: "#7C3AED" },
    pages: 3,
    brief:
      "Salão de beleza e estética. Destacar serviços, preços, marcas utilizadas e marcação online.",
    images: {
      hero: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
  {
    id: "landing-app",
    name: "App Launch",
    industry: "Landing page",
    industryLabel: "🚀 Landing page",
    description:
      "Landing page de lançamento: proposta de valor, vantagens, prova social e chamada à ação. Energética e focada em conversão.",
    style: "bold",
    colors: { from: "#7C3AED", to: "#06B6D4", accent: "#F59E0B" },
    pages: 2,
    brief:
      "Landing page de lançamento de uma aplicação. Proposta de valor clara, vantagens, prova social e chamada à ação.",
    images: {
      hero: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1400&q=80",
      about: "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
      ],
    },
  },
];

export function getAiTemplate(id: string | undefined | null): AiTemplate | null {
  if (!id) return null;
  return AI_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function createFallbackSitePayload(input: {
  businessName: string;
  industry?: string | null;
  tagline?: string | null;
  brief: string;
  templateId?: string | null;
  primaryColor?: string;
  accentColor?: string;
  typography?: "sans" | "display" | "mono";
}) {
  const template = input.templateId ? getAiTemplate(input.templateId) : null;
  const name = input.businessName || "Empresa Moçambicana";
  const tagline = input.tagline || template?.description || "Soluções de Excelência e Inovação em Moçambique";
  const primary = input.primaryColor || template?.colors.from || "#5227ff";
  const accent = input.accentColor || template?.colors.accent || "#7C3AED";
  const heroImage = template?.images.hero || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80";
  const aboutImage = template?.images.about || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80";
  const galleryImages = template?.images.gallery || [
    "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
  ];

  return {
    name,
    tagline,
    theme: {
      primaryColor: primary,
      accentColor: accent,
      mode: "light" as const,
      font: input.typography || "sans" as const,
    },
    seo: {
      title: `${name} — ${tagline}`,
      description: input.brief.slice(0, 160) || `Bem-vindo a ${name}. Excelência e qualidade em Moçambique.`,
    },
    pages: [
      {
        slug: "inicio",
        title: "Início",
        navLabel: "Início",
        sections: [
          {
            type: "hero" as const,
            id: "sec-1",
            headline: `Transforme o seu Negócio com a ${name}`,
            subheadline: tagline,
            align: "left" as const,
            image: heroImage,
            cta: { label: "Falar Connosco", href: "#contacto" },
          },
          {
            type: "about" as const,
            id: "sec-2",
            heading: `Sobre a ${name}`,
            body: input.brief.length > 30 ? input.brief : `A ${name} é uma referência no mercado moçambicano, dedicada a oferecer serviços de alta qualidade com foco total no cliente.`,
            bullets: [
              "Equipa experiente e profissional",
              "Atendimento personalizado em Maputo e todo o país",
              "Garantia de eficiência e rigor em cada projeto",
            ],
            image: aboutImage,
          },
          {
            type: "services" as const,
            id: "sec-3",
            heading: "Nossos Serviços em Destaque",
            intro: "Oferecemos soluções integradas adaptadas às necessidades do mercado moçambicano.",
            items: [
              { name: "Consultoria & Estratégia", description: "Acompanhamento profissional focado em resultados rápidos e sustentáveis." },
              { name: "Gestão & Execução", description: "Planeamento e implementação de projetos com padrões de excelência internacional." },
              { name: "Suporte Personalizado", description: "Assistência contínua e soluções feitas à medida das suas necessidades." },
            ],
          },
          {
            type: "stats" as const,
            id: "sec-4",
            heading: "Resultados que Falam por Nós",
            items: [
              { value: "100+", label: "Clientes Satisfeitos" },
              { value: "5+", label: "Anos de Experiência" },
              { value: "24/7", label: "Suporte Dedicado" },
            ],
          },
          {
            type: "testimonials" as const,
            id: "sec-5",
            heading: "O que Dizem os Nossos Clientes",
            items: [
              { quote: `Trabalhar com a ${name} foi uma excelente decisão. Profissionalismo de topo em Moçambique!`, author: "Armando Sitae", role: "Empresário em Maputo" },
              { quote: "Entrega rápida, serviço impecável e excelente comunicação do início ao fim.", author: "Sérgio Mabunda", role: "Gestor de Projetos" },
            ],
          },
          {
            type: "contact" as const,
            id: "sec-6",
            heading: "Fale Connosco Hoje",
            email: "contacto@idesignmoz.co.mz",
            phone: "+258 84 000 0000",
            address: "Av. Julius Nyerere, Maputo, Moçambique",
            note: "Responderemos à sua mensagem em menos de 24 horas úteis.",
          },
          {
            type: "footer" as const,
            id: "sec-7",
            text: `© ${new Date().getFullYear()} ${name}. Todos os direitos reservados.`,
          },
        ],
      },
      {
        slug: "servicos",
        title: "Serviços",
        navLabel: "Serviços",
        sections: [
          {
            type: "hero" as const,
            id: "sec-1",
            headline: `Serviços da ${name}`,
            subheadline: "Descubra como podemos impulsionar o seu sucesso.",
            align: "center" as const,
          },
          {
            type: "features" as const,
            id: "sec-2",
            heading: "Porquê Escolher os Nossos Serviços",
            items: [
              { title: "Rigor Profissional", text: "Processos alinhados com as melhores práticas de mercado." },
              { title: "Preço Justo", text: "Propostas transparentes sem custos ocultos." },
              { title: "Inovação Constante", text: "Tecnologia e métodos modernos ao serviço do seu crescimento." },
            ],
          },
          {
            type: "gallery" as const,
            id: "sec-3",
            heading: "Alguns dos Nossos Trabalhos",
            items: galleryImages.map((img, i) => ({
              label: `Projeto ${i + 1}`,
              caption: "Trabalho realizado com padrão de excelência.",
              image: img,
            })),
          },
          {
            type: "cta" as const,
            id: "sec-4",
            headline: "Pronto para Começar?",
            sub: "Entre em contacto com a nossa equipa e solicite uma proposta sem compromisso.",
            button: { label: "Pedir Proposta", href: "#contacto" },
          },
        ],
      },
    ],
  };
}