export type ProjectCategory =
  | "Websites"
  | "E-commerce"
  | "Branding"
  | "Apps"
  | "Marketing";

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  "Websites",
  "E-commerce",
  "Branding",
  "Apps",
  "Marketing",
];

export type Project = {
  slug: string;
  client: string;
  industry: string;
  year: string;
  categories: ProjectCategory[];
  services: string[];
  image: string;
  imageTone?: string;
  imageLabel?: string;
  summary: string;
  challenge: string;
  strategy: string;
  design: string;
  development: string;
  technology: string[];
  results: Array<{ metric: string; label: string }>;
  url?: string;
};

export const PROJECTS: Project[] = [
  {
    slug: "hotel-castel",
    client: "Hotel Castel",
    industry: "Hospitality",
    year: "2024",
    categories: ["Websites", "Branding", "Marketing"],
    services: ["Website", "Branding", "Digital Marketing"],
    image: "coastal",
    imageTone: "linear-gradient(140deg,#c7d7bf,#758d81 45%,#1d433e)",
    imageLabel: "Castel",
    summary: "Reservas sem fricção para uma experiência hoteleira premium.",
    challenge:
      "O Hotel Castel tinha uma presença digital datada que não refletia o nível do serviço. As reservas dependiam de chamadas e emails desorganizados, e a marca não se destacava num mercado competitivo.",
    strategy:
      "Posicionámos o hotel como uma experiência premium com mensagens claras sobre conforto e localização. Redefinimos a arquitectura de informação para guiar o visitante do primeiro contacto à reserva em poucos cliques.",
    design:
      "Uma identidade visual calma e sofisticada, com paleta de areia e verde, tipografia elevada e fotografia em destaque. Cada página foi desenhada para comunicar a experiência do hotel antes da chegada.",
    development:
      "Website rápido e responsivo construído com Next.js, com sistema de reservas, galeria optimizada e integração com WhatsApp para confirmações imediatas.",
    technology: ["Next.js", "React", "Tailwind CSS", "PostgreSQL"],
    results: [
      { metric: "+120%", label: "pedidos de contacto" },
      { metric: "-38%", label: "tempo até reservar" },
      { metric: "2×", label: "tráfego móvel" },
    ],
    url: "https://example.com",
  },
  {
    slug: "kaya-colectivo",
    client: "Kaya Colectivo",
    industry: "Culture & Retail",
    year: "2024",
    categories: ["E-commerce", "Branding"],
    services: ["E-commerce", "Branding"],
    image: "editorial",
    imageTone: "#e8e0d3",
    imageLabel: "Kaya",
    summary: "Uma loja online que se paga sozinha.",
    challenge:
      "Kaya Colectivo dependia das redes sociais para vender, o que limitava o alcance e a margem. Precisavam de uma loja própria onde os clientes pudessem descobrir, confiar e comprar.",
    strategy:
      "Criámos uma identidade editorial forte e uma loja focada em conversão, com storytelling por coleção e recomendações de produtos para aumentar o valor médio por encomenda.",
    design:
      "Uma estética editorial e artesanal com tipografia expressiva, cor terracota e espaços em branco que destacam o produto. A narrativa da marca está no centro de cada página.",
    development:
      "Plataforma de e-commerce completa com catálogo, categorias, pagamentos M-Pesa e cartão, gestão de pedidos e dashboard de analytics para a equipa.",
    technology: ["Next.js", "React", "Tailwind CSS", "Stripe", "M-Pesa API"],
    results: [
      { metric: "3×", label: "vendas online" },
      { metric: "+42%", label: "valor médio por pedido" },
      { metric: "M-Pesa", label: "pagamentos integrados" },
    ],
    url: "https://example.com",
  },
  {
    slug: "numa-systems",
    client: "Numa Systems",
    industry: "Technology",
    year: "2024",
    categories: ["Apps", "Websites"],
    services: ["Web App", "UI/UX"],
    image: "numa",
    imageTone: "#d8ff59",
    imageLabel: "Numa",
    summary: "Um dashboard SaaS para gestão de operações.",
    challenge:
      "Numa Systems precisava de um painel web para os seus clientes gerirem operações em tempo real. A interface anterior era confusa e dificultava a adopção.",
    strategy:
      "Desenhámos um layout de dashboard focado nas tarefas mais frequentes, com hierarquia de dados clara e atalhos para as acções críticas.",
    design:
      "Interface limpa e densa em informação, mas fácil de navegar, com componentes reutilizáveis e um sistema de design consistente.",
    development:
      "Aplicação web responsiva com autenticação, visualizações de dados em tempo real e integração com a API existente da empresa.",
    technology: ["Next.js", "React", "TypeScript", "PostgreSQL", "Tailwind CSS"],
    results: [
      { metric: "+60%", label: "adopção semanal" },
      { metric: "3s", label: "tempo médio de sessão" },
      { metric: "12", label: "integrações suportadas" },
    ],
    url: "https://example.com",
  },
  {
    slug: "amplius-consulting",
    client: "Amplius Consulting",
    industry: "Consulting",
    year: "2025",
    categories: ["Websites", "Marketing"],
    services: ["Website", "SEO", "Digital Marketing"],
    image: "coastal",
    imageTone: "linear-gradient(150deg,#dfe6cf,#8fa3b5 55%,#22384d)",
    imageLabel: "Amplius",
    summary: "Mais pedidos por semana com mensagens mais claras.",
    challenge:
      "Amplius, uma consultora, tinha um website institucional que não comunicava o valor dos seus serviços nem gerava pedidos de contacto de forma consistente.",
    strategy:
      "Reorganizámos a oferta em três pilares claros, com caminhos de conversão directos e provas sociais ao longo de cada página.",
    design:
      "Um visual profissional e sóbrio com uma paleta de azul-marinho e tons neutros, reforçando confiança e autoridade.",
    development:
      "Website rápido com SEO técnico, formulários de contacto inteligentes e integração de analytics para medir cada conversão.",
    technology: ["Next.js", "React", "Tailwind CSS", "Vercel"],
    results: [
      { metric: "+120%", label: "pedidos de contacto" },
      { metric: "3×", label: "visibilidade orgânica" },
    ],
    url: "https://example.com",
  },
  {
    slug: "clinica-polana",
    client: "Clínica Polana",
    industry: "Healthcare",
    year: "2023",
    categories: ["Websites", "Branding"],
    services: ["Website", "Branding"],
    image: "editorial",
    imageTone: "#eef2f4",
    imageLabel: "Polana",
    summary: "Uma presença digital clara e acolhedora para cuidados de saúde.",
    challenge:
      "A clínica precisava de transmitir confiança e acolhimento online, facilitando marcações e informação de serviços.",
    strategy:
      "Focámos em clareza e empatia: informação médica acessível, serviços bem organizados e um caminho simples para marcar consulta.",
    design:
      "Estética limpa e luminosa com verde-clínica e tons suaves que inspiram calma e profissionalismo.",
    development:
      "Website responsivo com sistema de marcações, páginas por especialidade e integração com WhatsApp.",
    technology: ["Next.js", "React", "Tailwind CSS", "PostgreSQL"],
    results: [
      { metric: "+55%", label: "marcações online" },
      { metric: "4.9★", label: "avaliação do serviço" },
    ],
  },
  {
    slug: "castel-branco",
    client: "Castel Branco",
    industry: "Hospitality",
    year: "2024",
    categories: ["Websites", "Branding", "Marketing"],
    services: ["Website", "Branding", "Digital Marketing"],
    image: "coastal",
    imageTone: "linear-gradient(140deg,#c7d7bf,#758d81 45%,#1d433e)",
    imageLabel: "Castel",
    summary: "Reservas sem fricção para uma experiência hoteleira premium.",
    challenge:
      "Transformar a presença digital do Castel Branco para competir no segmento premium, reduzindo a dependência de canais de terceiros.",
    strategy: "Uma marca de hospitalidade elevada, com storytelling e um fluxo de reserva directo e simples.",
    design: "Identidade premium com fotografia em destaque e uma hierarquia que comunica a experiência.",
    development: "Reservas integradas, galeria optimizada e integração de WhatsApp.",
    technology: ["Next.js", "React", "Tailwind CSS", "PostgreSQL"],
    results: [
      { metric: "-38%", label: "tempo até reservar" },
      { metric: "+90%", label: "reservas directas" },
    ],
  },
];

export const PROJECTS_BY_SLUG: Record<string, Project> = Object.fromEntries(
  PROJECTS.map((project) => [project.slug, project]),
);

export function getProjectsByCategory(category: ProjectCategory | "All"): Project[] {
  if (category === "All") return PROJECTS;
  return PROJECTS.filter((project) =>
    project.categories.includes(category),
  );
}
