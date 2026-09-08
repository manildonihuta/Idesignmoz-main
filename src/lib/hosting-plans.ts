export type HostingCategory =
  | "shared"
  | "wordpress"
  | "business"
  | "vps"
  | "reseller"
  | "email";

export type HostingPlan = {
  slug: string;
  name: string;
  description: string;
  category: HostingCategory;
  /** Prices are integer minor units of `currency` (never float). */
  monthlyPrice: number;
  annualPrice: number;
  currency?: "MZN" | "USD" | "EUR" | "ZAR";
  storage: string;
  websites: string;
  emails: string;
  databases: string;
  ssl: string;
  backup: string;
  support: string;
  features: string[];
  featured?: boolean;
  badge?: string;
};

export const CATEGORY_LABELS: Record<HostingCategory, string> = {
  shared: "Shared Hosting",
  wordpress: "WordPress",
  business: "Business",
  vps: "VPS",
  reseller: "Reseller",
  email: "Email",
};

export const CATEGORY_ORDER: HostingCategory[] = [
  "shared",
  "wordpress",
  "business",
  "vps",
  "reseller",
  "email",
];

/**
 * Fonte única e central dos planos de alojamento.
 * Para configurar, altere apenas os valores abaixo — a UI, os cards e as
 * páginas de detalhe atualizam automaticamente.
 */
export const HOSTING_PLANS: HostingPlan[] = [
  // ─── Shared Hosting ──────────────────────────────────────────────
  {
    slug: "shared-starter",
    name: "Starter",
    description: "O começo certo para o seu primeiro espaço online.",
    category: "shared",
    monthlyPrice: 499,
    annualPrice: 4990,
    storage: "10 GB SSD",
    websites: "1 Website",
    emails: "5 Email Accounts",
    databases: "1 Database",
    ssl: "Free SSL",
    backup: "Daily Backup",
    support: "Email Support",
    features: ["10 GB SSD", "1 Website", "5 Email Accounts", "1 Database", "Free SSL", "Daily Backup"],
  },
  {
    slug: "shared-business",
    name: "Business",
    description: "Espaço para a sua equipa crescer sem limites.",
    category: "shared",
    monthlyPrice: 999,
    annualPrice: 9990,
    storage: "30 GB NVMe",
    websites: "10 Websites",
    emails: "Unlimited Email",
    databases: "Unlimited Databases",
    ssl: "Free SSL",
    backup: "Daily Backup",
    support: "Priority Support",
    features: ["30 GB NVMe", "10 Websites", "Unlimited Email", "Databases", "Free SSL", "Daily Backup", "Priority Support"],
    featured: true,
    badge: "Mais escolhido",
  },
  {
    slug: "shared-pro",
    name: "Pro",
    description: "Potência para quem precisa de mais recursos.",
    category: "shared",
    monthlyPrice: 1999,
    annualPrice: 19990,
    storage: "100 GB NVMe",
    websites: "Unlimited Websites",
    emails: "Unlimited Email",
    databases: "Unlimited Databases",
    ssl: "Free SSL",
    backup: "Advanced Backup",
    support: "Priority Support",
    features: ["100 GB NVMe", "Unlimited Websites", "Unlimited Email", "Advanced Backup", "SSL", "Priority Support"],
  },

  // ─── WordPress ───────────────────────────────────────────────────
  {
    slug: "wp-starter",
    name: "WP Starter",
    description: "WordPress otimizado, rápido e seguro para começar.",
    category: "wordpress",
    monthlyPrice: 599,
    annualPrice: 5990,
    storage: "15 GB NVMe",
    websites: "1 WordPress",
    emails: "5 Email Accounts",
    databases: "1 Database",
    ssl: "Free SSL + CDN",
    backup: "Daily Backup",
    support: "WP Support",
    features: ["15 GB NVMe", "1 WordPress Site", "5 Email Accounts", "1 Database", "Free SSL + CDN", "Daily Backup", "WP-Optimized"],
  },
  {
    slug: "wp-growth",
    name: "WP Growth",
    description: "Mais sites e performance para WordPress em crescimento.",
    category: "wordpress",
    monthlyPrice: 1099,
    annualPrice: 10990,
    storage: "40 GB NVMe",
    websites: "10 WordPress",
    emails: "Unlimited Email",
    databases: "Unlimited Databases",
    ssl: "Free SSL + CDN",
    backup: "Daily Backup",
    support: "Priority WP Support",
    features: ["40 GB NVMe", "10 WordPress Sites", "Unlimited Email", "Unlimited Databases", "Free SSL + CDN", "Daily Backup", "Priority Support"],
    featured: true,
    badge: "Mais popular",
  },
  {
    slug: "wp-ultimate",
    name: "WP Ultimate",
    description: "O máximo de WordPress para projetos exigentes.",
    category: "wordpress",
    monthlyPrice: 2199,
    annualPrice: 21990,
    storage: "120 GB NVMe",
    websites: "Unlimited WordPress",
    emails: "Unlimited Email",
    databases: "Unlimited Databases",
    ssl: "Free SSL + CDN",
    backup: "Advanced + Staging",
    support: "Priority Support",
    features: ["120 GB NVMe", "Unlimited WordPress", "Unlimited Email", "Advanced Backup", "Stage Environments", "Free SSL + CDN", "Priority Support"],
  },

  // ─── Business ────────────────────────────────────────────────────
  {
    slug: "business-start",
    name: "Business Start",
    description: "Recursos dedicados para pequenos e médios negócios.",
    category: "business",
    monthlyPrice: 1499,
    annualPrice: 14990,
    storage: "50 GB NVMe",
    websites: "20 Websites",
    emails: "Unlimited Email",
    databases: "20 Databases",
    ssl: "Free SSL",
    backup: "Daily + Weekly",
    support: "Priority Support",
    features: ["50 GB NVMe", "20 Websites", "Unlimited Email", "20 Databases", "Free SSL", "Daily + Weekly Backup", "Priority Support"],
  },
  {
    slug: "business-scale",
    name: "Business Scale",
    description: "Para negócios que exigem performance consistente.",
    category: "business",
    monthlyPrice: 2999,
    annualPrice: 29990,
    storage: "150 GB NVMe",
    websites: "Unlimited Websites",
    emails: "Unlimited Email",
    databases: "Unlimited Databases",
    ssl: "Free SSL + Wildcard",
    backup: "Advanced + Staging",
    support: "Dedicated Support",
    features: ["150 GB NVMe", "Unlimited Websites", "Unlimited Email", "Unlimited Databases", "Wildcard SSL", "Advanced Backup", "Dedicated Support"],
    featured: true,
    badge: "Recomendado",
  },

  // ─── VPS ─────────────────────────────────────────────────────────
  {
    slug: "vps-2",
    name: "VPS 2GB",
    description: "Servidor virtual dedicado com recursos garantidos.",
    category: "vps",
    monthlyPrice: 2999,
    annualPrice: 29990,
    storage: "50 GB NVMe",
    websites: "Unlimited",
    emails: "Unlimited",
    databases: "Unlimited",
    ssl: "Free SSL",
    backup: "Weekly",
    support: "24/7 Managed",
    features: ["2 vCPU", "2 GB RAM", "50 GB NVMe", "Unlimited Websites", "Unlimited Email", "Root Access", "Free SSL", "24/7 Managed"],
  },
  {
    slug: "vps-4",
    name: "VPS 4GB",
    description: "Mais RAM e processamento para cargas maiores.",
    category: "vps",
    monthlyPrice: 5999,
    annualPrice: 59990,
    storage: "100 GB NVMe",
    websites: "Unlimited",
    emails: "Unlimited",
    databases: "Unlimited",
    ssl: "Free SSL",
    backup: "Daily",
    support: "24/7 Managed",
    features: ["4 vCPU", "4 GB RAM", "100 GB NVMe", "Unlimited Websites", "Unlimited Email", "Root Access", "Free SSL", "Daily Backup", "24/7 Managed"],
    featured: true,
    badge: "Mais popular",
  },
  {
    slug: "vps-8",
    name: "VPS 8GB",
    description: "Alto desempenho para aplicações e e-commerce.",
    category: "vps",
    monthlyPrice: 9999,
    annualPrice: 99990,
    storage: "200 GB NVMe",
    websites: "Unlimited",
    emails: "Unlimited",
    databases: "Unlimited",
    ssl: "Free SSL + Wildcard",
    backup: "Daily + Snapshot",
    support: "24/7 Priority Managed",
    features: ["8 vCPU", "8 GB RAM", "200 GB NVMe", "Unlimited Websites", "Unlimited Email", "Root Access", "Wildcard SSL", "Snapshot Backups", "24/7 Priority Managed"],
  },

  // ─── Reseller ────────────────────────────────────────────────────
  {
    slug: "reseller-25",
    name: "Reseller 25",
    description: "Venda alojamento com a sua marca. Até 25 contas.",
    category: "reseller",
    monthlyPrice: 4999,
    annualPrice: 49990,
    storage: "100 GB NVMe",
    websites: "25 Hosting Accounts",
    emails: "Unlimited",
    databases: "Unlimited",
    ssl: "Free SSL",
    backup: "Daily",
    support: "Whitelabel Support",
    features: ["100 GB NVMe", "25 Hosting Accounts", "Unlimited Email", "Unlimited Databases", "Free SSL", "Daily Backup", "White-label Control Panel"],
  },
  {
    slug: "reseller-unlimited",
    name: "Reseller Unlimited",
    description: "Sem limites de contas para agências e revendedores.",
    category: "reseller",
    monthlyPrice: 9999,
    annualPrice: 99990,
    storage: "250 GB NVMe",
    websites: "Unlimited Accounts",
    emails: "Unlimited",
    databases: "Unlimited",
    ssl: "Free SSL + Wildcard",
    backup: "Daily + Advanced",
    support: "Priority Whitelabel",
    features: ["250 GB NVMe", "Unlimited Accounts", "Unlimited Email", "Unlimited Databases", "Wildcard SSL", "Advanced Backup", "White-label Control Panel"],
    featured: true,
    badge: "Para agências",
  },

  // ─── Email ───────────────────────────────────────────────────────
  {
    slug: "email-10",
    name: "Email 10",
    description: "Email profissional no seu domínio. Até 10 caixas.",
    category: "email",
    monthlyPrice: 199,
    annualPrice: 1990,
    storage: "10 GB",
    websites: "—",
    emails: "10 Mailboxes",
    databases: "—",
    ssl: "Free SSL",
    backup: "Daily",
    support: "Email Support",
    features: ["10 Mailboxes", "10 GB Total Storage", "Webmail + IMAP/SMTP", "Free SSL", "Daily Backup", "Spam & Virus Protection"],
  },
  {
    slug: "email-50",
    name: "Email 50",
    description: "Para equipas maiores, com mais armazenamento.",
    category: "email",
    monthlyPrice: 499,
    annualPrice: 4990,
    storage: "50 GB",
    websites: "—",
    emails: "50 Mailboxes",
    databases: "—",
    ssl: "Free SSL",
    backup: "Daily",
    support: "Priority Support",
    features: ["50 Mailboxes", "50 GB Total Storage", "Webmail + IMAP/SMTP", "Free SSL", "Daily Backup", "Spam & Virus Protection", "Priority Support"],
    featured: true,
    badge: "Popular",
  },
  {
    slug: "email-100",
    name: "Email 100",
    description: "Solução completa para empresas com muitos utilizadores.",
    category: "email",
    monthlyPrice: 899,
    annualPrice: 8990,
    storage: "100 GB",
    websites: "—",
    emails: "100 Mailboxes",
    databases: "—",
    ssl: "Free SSL",
    backup: "Daily + Archive",
    support: "Dedicated Support",
    features: ["100 Mailboxes", "100 GB Total Storage", "Webmail + IMAP/SMTP", "Free SSL", "Daily + Archive Backup", "Spam & Virus Protection", "Dedicated Support"],
  },
];

export const HOSTING_PLANS_BY_SLUG: Record<string, HostingPlan> = Object.fromEntries(
  HOSTING_PLANS.map((plan) => [plan.slug, plan]),
);

export function getPlansByCategory(category: HostingCategory): HostingPlan[] {
  return HOSTING_PLANS.filter((plan) => plan.category === category);
}

export function formatMT(value: number): string {
  return new Intl.NumberFormat("pt-MZ").format(value);
}
