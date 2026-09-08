import { HOSTING_PLANS, type HostingPlan } from "@/lib/hosting-plans";
import { formatMoneyParts, type CurrencyCode } from "@/lib/currency";

/* --------------------------------------------------------------------- *
 * Unified product catalog — SEED SOURCE (server/seed only).
 *
 * Supports the business model:
 *   One-time revenue : website, branding, software, design
 *   Recurring revenue: hosting, domains, email, maintenance, SEO, marketing
 *
 * Pure types/taxonomy live in `./catalog-types` (client-safe). The data
 * below is the source of truth for seeding `site_settings.catalog_products`
 * (`scripts/seed-content.test.ts`). At runtime, clients load products from
 * `/api/catalog` and servers via `src/lib/content`.
 *
 * The upsell path (Domain → Hosting → Email → Website → SEO → Marketing →
 * Maintenance) is used to recommend related products during checkout.
 * --------------------------------------------------------------------- */

export type {
  ProductCategory,
  ProductType,
  SellPeriod,
  CatalogProduct,
  CrossSellOffer,
} from "./catalog-types";
import {
  UPSEL_CHAIN,
  UPSEL_AFTER,
  type CatalogProduct,
  type CrossSellOffer,
  type ProductCategory,
} from "./catalog-types";
export {
  CATEGORY_LABEL_PT,
  CATEGORY_ICON,
  UPSEL_CHAIN,
  UPSEL_AFTER,
  PRODUCT_CATEGORIES,
  categoryLabel,
  formatProductPrice,
  currencySymbol,
  sellPeriodLabel,
  isRecurringCategory,
} from "./catalog-types";

/* --------------------------------------------------------------------- *
 * Catalog sources
 * --------------------------------------------------------------------- */

function fromHosting(plan: HostingPlan, category: "hosting" | "email"): CatalogProduct {
  return {
    id: `hosting-${plan.slug}`,
    name: plan.name,
    category,
    type: "recurring",
    price: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    currency: plan.currency ?? "MZN",
    description: plan.description,
    features: plan.features,
    href: `/hosting/${plan.slug}`,
    icon: category === "hosting" ? "🖥" : "✉️",
  };
}

const hostingProducts: CatalogProduct[] = HOSTING_PLANS.filter((p) => p.category !== "email").map((p) =>
  fromHosting(p, "hosting"),
);

const emailProducts: CatalogProduct[] = HOSTING_PLANS.filter((p) => p.category === "email").map((p) =>
  fromHosting(p, "email"),
);

/* One-time projects and recurring services. Prices match src/lib/pricing-plans.ts
 * and src/lib/services.ts where those define a value; a few (branding/design/
 * software) are catalog-level starting prices so they can be bought online. */
const projectProducts: Omit<CatalogProduct, "currency">[] = [
  {
    id: "website-starter",
    name: "Starter Website",
    category: "website",
    type: "one_time",
    price: 25000,
    description: "Uma base elegante com cinco páginas.",
    features: ["Design responsivo", "Domínio + alojamento 1 ano", "Até 5 páginas", "SEO básico", "Integração WhatsApp"],
    href: "/services/web-development",
    icon: "◻️",
  },
  {
    id: "website-business",
    name: "Business Website",
    category: "website",
    type: "one_time",
    price: 55000,
    description: "Website profissional para negócios em crescimento.",
    features: ["Design personalizado", "Até 15 páginas", "SEO", "Email profissional", "Analytics"],
    href: "/services/web-development",
    icon: "◻️",
  },
  {
    id: "website-ecommerce",
    name: "E-commerce",
    category: "website",
    type: "one_time",
    price: 85000,
    description: "Loja online completa com pagamentos M-Pesa e cartão.",
    features: ["Loja online", "Produtos e categorias", "Pagamentos", "WhatsApp", "Gestão de pedidos"],
    href: "/services/e-commerce",
    icon: "🛒",
  },
  {
    id: "branding-identity",
    name: "Branding & Identidade",
    category: "branding",
    type: "one_time",
    price: 22000,
    description: "Identidade visual completa para a sua marca.",
    features: ["Logótipo", "Paleta de cores", "Tipografia", "Cartões de visita", "Guia de marca"],
    href: "/services/branding",
    icon: "🎨",
  },
  {
    id: "design-criativo",
    name: "Design Gráfico",
    category: "design",
    type: "one_time",
    price: 15000,
    description: "Materiais gráficos para campanhas e redes sociais.",
    features: ["Posts sociais", "Banners", "Flyers", "Apresentações"],
    href: "/services/branding",
    icon: "✏️",
  },
  {
    id: "software-aplicacao",
    name: "Software à Medida",
    category: "software",
    type: "one_time",
    price: 95000,
    description: "Software personalizado para automatizar o seu negócio.",
    features: ["Análise de requisitos", "Desenvolvimento", "Testes", "Formação", "Suporte inicial"],
    href: "/services/software-development",
    icon: "⚙️",
  },
];

const recurringServiceProducts: Omit<CatalogProduct, "currency">[] = [
  {
    id: "seo-essencial",
    name: "SEO Essencial",
    category: "seo",
    type: "recurring",
    price: 12000,
    annualPrice: 115200,
    description: "Otimização contínua para aparecer no Google.",
    features: ["Auditoria técnica", "Palavras-chave", "Otimização on-page", "Relatório mensal"],
    href: "/services/seo",
    icon: "🔍",
  },
  {
    id: "marketing-essentials",
    name: "Marketing Essentials",
    category: "marketing",
    type: "recurring",
    price: 15000,
    annualPrice: 144000,
    description: "Gestão de presença digital e redes sociais.",
    features: ["Redes sociais", "Conteúdo", "Calendário editorial", "Relatório mensal"],
    href: "/services/digital-marketing",
    icon: "📣",
  },
  {
    id: "marketing-growth",
    name: "Marketing Growth",
    category: "marketing",
    type: "recurring",
    price: 30000,
    annualPrice: 288000,
    description: "Campanhas pagas e crescimento acelerado.",
    features: ["Ads (Google/Meta)", "Funil de vendas", "Email marketing", "Análise avançada"],
    href: "/services/digital-marketing",
    icon: "📈",
  },
  {
    id: "marketing-scale",
    name: "Marketing Scale",
    category: "marketing",
    type: "recurring",
    price: 60000,
    annualPrice: 576000,
    description: "Estratégia completa para escalar resultados.",
    features: ["Conteúdo ilimitado", "SEO avançado", "Account manager", "Otimização contínua"],
    href: "/services/digital-marketing",
    icon: "📣",
  },
  {
    id: "maintenance-care",
    name: "Maintenance Care",
    category: "maintenance",
    type: "recurring",
    price: 3500,
    annualPrice: 33600,
    description: "Manutenção mensal do seu website.",
    features: ["Atualizações", "Backups", "Monitorização", "Suporte 1x/mês"],
    href: "/services/web-development",
    icon: "🛠",
  },
  {
    id: "maintenance-growth-care",
    name: "Maintenance Growth Care",
    category: "maintenance",
    type: "recurring",
    price: 7000,
    annualPrice: 67200,
    description: "Cuidados reforçados com o seu website.",
    features: ["Atualizações", "Backups diários", "Monitorização 24/7", "Conteúdo 1x/semana"],
    href: "/services/web-development",
    icon: "🛠",
  },
  {
    id: "maintenance-premium-care",
    name: "Maintenance Premium Care",
    category: "maintenance",
    type: "recurring",
    price: 12000,
    annualPrice: 115200,
    description: "Tudo o que precisa com prioridade total.",
    features: ["Edições mensais", "SEO contínuo", "Suporte dedicado"],
    href: "/services/web-development",
    icon: "🛠",
  },
];

export const CATALOG: CatalogProduct[] = [
  ...hostingProducts,
  ...emailProducts,
  ...(projectProducts as CatalogProduct[]),
  ...(recurringServiceProducts as CatalogProduct[]),
].map((p) => ({ ...p, currency: (p.currency ?? "MZN") as CurrencyCode }));

export const CATALOG_BY_ID: Record<string, CatalogProduct> = Object.fromEntries(
  CATALOG.map((p) => [p.id, p]),
);

/* --------------------------------------------------------------------- *
 * Helpers
 * --------------------------------------------------------------------- */

export function getCatalogProduct(id: string): CatalogProduct | undefined {
  return CATALOG_BY_ID[id];
}

export function formatMT(n: number): string {
  return formatMoneyParts(n, "MZN");
}

/** One recommended product for an upsell category (used by checkout suggestions). */
export function defaultProductForCategory(cat: ProductCategory): CatalogProduct | undefined {
  if (cat === "hosting") return CATALOG_BY_ID["hosting-shared-business"];
  if (cat === "email") return CATALOG_BY_ID["hosting-email-50"];
  if (cat === "website") return CATALOG_BY_ID["website-business"];
  if (cat === "seo") return CATALOG_BY_ID["seo-essencial"];
  if (cat === "marketing") return CATALOG_BY_ID["marketing-growth"];
  if (cat === "maintenance") return CATALOG_BY_ID["maintenance-growth-care"];
  return undefined;
}

/** Id of the default product for an upsell category (used by seeding cross-sell rules). */
export function defaultProductIdForCategory(cat: ProductCategory): string | undefined {
  return defaultProductForCategory(cat)?.id;
}

/**
 * Walks the upsell chain and returns the next recommended categories not
 * already in the cart. `cartCategories` = distinct product categories present.
 */
export function suggestUpsells(cartCategories: ProductCategory[]): ProductCategory[] {
  const inCart = new Set(cartCategories);
  const suggested: ProductCategory[] = [];
  for (const cat of UPSEL_CHAIN) {
    const next = UPSEL_AFTER[cat];
    if (next && inCart.has(cat) && !inCart.has(next)) {
      suggested.push(next);
    }
  }
  return suggested;
}

/** Catalog products surfaced on each service detail page (by service slug). */
export const SERVICE_TO_CATALOG: Record<string, string[]> = {
  "web-development": ["website-starter", "website-business", "website-ecommerce"],
  "e-commerce": ["website-ecommerce"],
  branding: ["branding-identity", "design-criativo"],
  "software-development": ["software-aplicacao"],
  seo: ["seo-essencial"],
  "digital-marketing": ["marketing-essentials", "marketing-growth", "marketing-scale"],
};

/** Catalog product for each pricing marketplace plan (by plan name). */
export const PRICING_TO_CATALOG: Record<string, string> = {
  "Starter Website": "website-starter",
  "Business Website": "website-business",
  Ecommerce: "website-ecommerce",
  "E-commerce": "website-ecommerce",
  Starter: "hosting-shared-starter",
  Business: "hosting-shared-business",
  Pro: "hosting-shared-pro",
  Essentials: "marketing-essentials",
  Growth: "marketing-growth",
  Scale: "marketing-scale",
  Care: "maintenance-care",
  "Growth Care": "maintenance-growth-care",
  "Premium Care": "maintenance-premium-care",
};

/* --------------------------------------------------------------------- *
 * Cross-sell engine (SEED SOURCE).
 *
 * After a purchase (or based on what the customer already owns) we offer
 * the natural "next step" products — the items they haven't bought yet,
 * ordered by the upsell chain (Domain → Hosting → Email → Website → SEO →
 * Marketing → Maintenance) plus project categories (Branding/Design/
 * Software → Website).
 * --------------------------------------------------------------------- */

type CrossSellRule = { category: ProductCategory; eyebrow: string; headline: string; body: string };

export const CROSS_SELL_RULES: Record<ProductCategory, CrossSellRule[]> = {
  domain: [
    {
      category: "hosting",
      eyebrow: "O seu domínio está pronto.",
      headline: "Complete a sua configuração",
      body: "Hospede o seu site com SSL, backups diários e suporte local.",
    },
    {
      category: "email",
      eyebrow: "O seu domínio está pronto.",
      headline: "Complete a sua configuração",
      body: "Email profissional com o seu próprio nome de domínio.",
    },
    {
      category: "website",
      eyebrow: "O seu domínio está pronto.",
      headline: "Complete a sua configuração",
      body: "Tenha uma presença online pronta para crescer.",
    },
  ],
  hosting: [
    {
      category: "website",
      eyebrow: "Precisa de um website?",
      headline: "Construa o seu website com a IDesign Moz",
      body: "Design responsivo, focado em conversão e com SEO incluído.",
    },
    {
      category: "email",
      eyebrow: "Precisa de um website?",
      headline: "Já tem alojamento — adicione email",
      body: "Email profissional no seu domínio, sem esforço.",
    },
  ],
  email: [
    {
      category: "website",
      eyebrow: "Email configurado.",
      headline: "Agora, o seu website",
      body: "Transforme visitantes em clientes com um site à medida.",
    },
    {
      category: "seo",
      eyebrow: "Email configurado.",
      headline: "Agora, o seu website",
      body: "Atraia tráfego qualificado que já sabe o que procura.",
    },
  ],
  website: [
    {
      category: "seo",
      eyebrow: "Cresça o seu tráfego.",
      headline: "Grow your traffic with SEO",
      body: "Apareça no Google para quem procura o que você vende.",
    },
    {
      category: "maintenance",
      eyebrow: "Cresça o seu tráfego.",
      headline: "Mantenha o seu site no ar",
      body: "Atualizações, backups e suporte mensal dedicado.",
    },
  ],
  seo: [
    {
      category: "marketing",
      eyebrow: "SEO em curso.",
      headline: "Potencie com marketing digital",
      body: "Redes sociais e campanhas pagas para crescer mais depressa.",
    },
    {
      category: "maintenance",
      eyebrow: "SEO em curso.",
      headline: "…e cuide do seu site",
      body: "Manutenção mensal com melhorias contínuas.",
    },
  ],
  marketing: [
    {
      category: "maintenance",
      eyebrow: "Marketing no ar.",
      headline: "Mantenha tudo consistente",
      body: "Suporte e melhorias contínuas para a sua presença digital.",
    },
  ],
  maintenance: [],
  branding: [
    {
      category: "website",
      eyebrow: "Marca definida.",
      headline: "Apresente-a online",
      body: "Um website à altura da sua nova identidade visual.",
    },
  ],
  software: [
    {
      category: "website",
      eyebrow: "Software entregue.",
      headline: "Promova-o online",
      body: "Um website que explica e vende a sua solução.",
    },
  ],
  design: [
    {
      category: "website",
      eyebrow: "Design pronto.",
      headline: "Ponha-o a trabalhar",
      body: "Leve o seu design para um website profissional.",
    },
  ],
};

/**
 * Recommends cross-sell offers the customer does NOT already own, based on
 * their purchased categories. Triggered by the upsell chain, then project
 * categories. Skips "domain" (recommended action is a link to search, not a
 * catalog product) and anything already purchased.
 */
export function crossSellOffers(purchased: ProductCategory[], limit = 3): CrossSellOffer[] {
  const owned = new Set(purchased);
  const offers: CrossSellOffer[] = [];
  const pushFor = (triggers: ProductCategory[]) => {
    for (const trigger of triggers) {
      if (!owned.has(trigger)) continue;
      for (const rule of CROSS_SELL_RULES[trigger] ?? []) {
        if (offers.length >= limit) return;
        if (owned.has(rule.category)) continue;
        const product = defaultProductForCategory(rule.category);
        if (!product) continue;
        offers.push({ ...rule, productId: product.id, href: product.href });
      }
    }
  };
  pushFor([...UPSEL_CHAIN]);
  if (offers.length < limit) {
    pushFor(["branding", "software", "design"]);
  }
  return offers;
}