export type PricingCategory =
  | "Websites"
  | "Hosting"
  | "Domains"
  | "Marketing"
  | "Maintenance";

export const PRICING_CATEGORIES: PricingCategory[] = [
  "Websites",
  "Hosting",
  "Domains",
  "Marketing",
  "Maintenance",
];

export type PricingEntry = {
  name: string;
  category: PricingCategory;
  description: string;
  monthly: number;
  annual: number;
  unit: string;
  features: string[];
  featured?: boolean;
  badge?: string;
  href: string;
  cta: string;
};

/**
 * Desconto anual configurável (percentagem aplicada ao total anual
 * calculado a partir do preço mensal). Ajuste aqui para mudar a oferta.
 */
export const ANNUAL_DISCOUNT = 20; // %

/**
 * Fonte única e central dos planos de preços.
 * Edite os valores abaixo — a UI atualiza automaticamente.
 */
export const PRICING_PLANS: PricingEntry[] = [
  // ─── Websites ─────────────────────────────────────────────────────
  {
    name: "Starter Website",
    category: "Websites",
    description: "Uma base elegante com cinco páginas.",
    monthly: 25000,
    annual: 250000,
    unit: "pagamento único",
    features: [
      "Design responsivo personalizado",
      "Domínio + alojamento por 1 ano",
      "Up to 5 pages",
      "Configuração SEO básica",
      "Integração com WhatsApp",
    ],
    href: "/services/web-development",
    cta: "Start Project",
  },
  {
    name: "Business Website",
    category: "Websites",
    description: "Uma presença digital pronta para crescer.",
    monthly: 55000,
    annual: 550000,
    unit: "pagamento único",
    features: [
      "Até 15 páginas",
      "Design custom",
      "SEO + analytics",
      "Google integration",
      "Email profissional",
      "30 dias de suporte",
    ],
    featured: true,
    badge: "Recomendado",
    href: "/services/web-development",
    cta: "Start Project",
  },
  {
    name: "E-commerce",
    category: "Websites",
    description: "Transforme atenção em vendas.",
    monthly: 85000,
    annual: 850000,
    unit: "pagamento único",
    features: [
      "Configuração da loja online",
      "Pagamentos + gestão de pedidos",
      "Catálogo de produtos",
      "Gestão de encomendas",
      "Formação para a sua equipa",
    ],
    href: "/services/e-commerce",
    cta: "Start Project",
  },

  // ─── Hosting ──────────────────────────────────────────────────────
  {
    name: "Starter",
    category: "Hosting",
    description: "O começo certo para o seu primeiro espaço online.",
    monthly: 499,
    annual: 4990,
    unit: "mês",
    features: ["10 GB SSD", "1 Website", "5 Email Accounts", "Free SSL", "Daily Backup"],
    href: "/hosting/shared-starter",
    cta: "Get Started",
  },
  {
    name: "Business",
    category: "Hosting",
    description: "Espaço para a sua equipa crescer sem limites.",
    monthly: 999,
    annual: 9990,
    unit: "mês",
    features: ["30 GB NVMe", "10 Websites", "Unlimited Email", "Free SSL", "Daily Backup", "Priority Support"],
    featured: true,
    badge: "Mais escolhido",
    href: "/hosting/shared-business",
    cta: "Get Started",
  },
  {
    name: "Pro",
    category: "Hosting",
    description: "Potência para quem precisa de mais recursos.",
    monthly: 1999,
    annual: 19990,
    unit: "mês",
    features: ["100 GB NVMe", "Unlimited Websites", "Unlimited Email", "Advanced Backup", "Priority Support"],
    href: "/hosting/shared-pro",
    cta: "Get Started",
  },

  // ─── Domains ──────────────────────────────────────────────────────
  {
    name: ".com",
    category: "Domains",
    description: "O domínio mais reconhecido do mundo.",
    monthly: 900,
    annual: 9000,
    unit: "por ano",
    features: ["WHOIS privacy incluído", "DNS management", "Renovação automática opcional"],
    href: "/domains",
    cta: "Registe o seu",
  },
  {
    name: ".co.mz",
    category: "Domains",
    description: "A presença local de Moçambique.",
    monthly: 1200,
    annual: 12000,
    unit: "por ano",
    features: ["Presença local", "Registo nacional", "DNS management", "Renovação automática"],
    featured: true,
    badge: "Popular",
    href: "/domains",
    cta: "Registe o seu",
  },
  {
    name: ".co",
    category: "Domains",
    description: "Moderno, curto e memorável.",
    monthly: 1000,
    annual: 10000,
    unit: "por ano",
    features: ["WHOIS privacy incluído", "DNS management", "Renovação automática opcional"],
    href: "/domains",
    cta: "Registe o seu",
  },

  // ─── Marketing ────────────────────────────────────────────────────
  {
    name: "Essentials",
    category: "Marketing",
    description: "Um arranque sólido para a sua presença digital.",
    monthly: 15000,
    annual: 144000,
    unit: "mês",
    features: ["4 publicações / mês", "Gestão de redes sociais", "Relatório mensal", "Suporte por email"],
    href: "/services/digital-marketing",
    cta: "Request Quote",
  },
  {
    name: "Growth",
    category: "Marketing",
    description: "Crescimento consistente com mais canais.",
    monthly: 30000,
    annual: 288000,
    unit: "mês",
    features: ["8 publicações / mês", "SEO mensal", "Campanhas pagas", "Relatório mensal detalhado"],
    featured: true,
    badge: "Recomendado",
    href: "/services/digital-marketing",
    cta: "Request Quote",
  },
  {
    name: "Scale",
    category: "Marketing",
    description: "Estratégia completa para escalar resultados.",
    monthly: 60000,
    annual: 576000,
    unit: "mês",
    features: ["Conteúdo ilimitado", "SEO avançado", "Campanhas pagas + account manager", "Análise e otimização contínua"],
    href: "/services/digital-marketing",
    cta: "Request Quote",
  },

  // ─── Maintenance ──────────────────────────────────────────────────
  {
    name: "Care",
    category: "Maintenance",
    description: "Manutenção básica para o seu site estar sempre no ar.",
    monthly: 3500,
    annual: 33600,
    unit: "mês",
    features: ["Atualizações de segurança", "Backups semanais", "Monitorização de uptime", "Suporte por email"],
    href: "/services/web-development",
    cta: "Request Quote",
  },
  {
    name: "Growth Care",
    category: "Maintenance",
    description: "Mais atenção e melhorias regulares.",
    monthly: 7000,
    annual: 67200,
    unit: "mês",
    features: ["Tudo do plano Care", "Pequenas edições de conteúdo", "Relatório mensal", "Suporte prioritário"],
    featured: true,
    badge: "Recomendado",
    href: "/services/web-development",
    cta: "Request Quote",
  },
  {
    name: "Premium Care",
    category: "Maintenance",
    description: "Tudo o que precisa com prioridade total.",
    monthly: 12000,
    annual: 115200,
    unit: "mês",
    features: ["Tudo do Growth Care", "Edições e melhorias mensais", "SEO contínuo", "Suporte dedicado"],
    href: "/services/web-development",
    cta: "Request Quote",
  },
];

export function getPlansByCategory(category: PricingCategory): PricingEntry[] {
  return PRICING_PLANS.filter((plan) => plan.category === category);
}

export function formatMT(value: number): string {
  const rounded = Math.round(value / 100) * 100;
  return new Intl.NumberFormat("pt-MZ").format(rounded);
}

export function annualTotal(plan: PricingEntry): number {
  return plan.monthly * 12 * (1 - ANNUAL_DISCOUNT / 100);
}
