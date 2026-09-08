/*
 * Local storage for the admin catalog/management views.
 * These stores are client-side only (localStorage) and let the
 * administrator change prices, products, plans and extensions without
 * touching code. Site-wide live application is the next step (database).
 */

export type CustomerStatus = "Ativo" | "Suspenso";

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  nuit?: string;
  status: CustomerStatus;
  createdAt: string;
};

export type RelatedKind =
  | "Pedidos"
  | "Pagamentos"
  | "Domínios"
  | "Hosting"
  | "Projetos"
  | "Tickets";

export type RelatedRow = {
  id: string;
  title: string;
  meta: string;
  status: string;
  value?: string;
};

export type AdminCategory = { id: string; name: string };

export type AdminProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  period: string;
  features: string[];
  active: boolean;
};

export type AdminPlan = {
  id: string;
  name: string;
  category: string;
  price: number;
  period: string;
  features: string[];
  active: boolean;
};

export type AdminCoupon = {
  id: string;
  code: string;
  percent: number;
  active: boolean;
};

export type AdminCatalog = {
  categories: AdminCategory[];
  products: AdminProduct[];
  plans: AdminPlan[];
  coupons: AdminCoupon[];
};

export type AdminExtension = {
  extension: string;
  register: number;
  renewal: number;
  transfer: number;
  available: boolean;
  suspended: boolean;
  expires: string;
  renewCount: number;
};

export const EXPIRY_POOL = [
  "30 Jan 2027",
  "30 Jan 2028",
  "30 Jan 2029",
  "30 Jan 2030",
];

export type AdminHostingPlanRow = {
  id: string;
  name: string;
  server: string;
  storage: string;
  websites: string;
  emails: string;
  databases: string;
  monthly: number;
  annual: number;
  cycle: "monthly" | "annual";
  status: "Ativo" | "Suspenso";
};

export function loadStore<T>(key: string, seed: T): T {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return seed;
}

export function saveStore<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function nextId(prefix: string, items: Array<{ id: string }>, base: number): string {
  return `${prefix}-${base + items.length + 1}`;
}

export const SEED_CUSTOMERS: AdminCustomer[] = [
  {
    id: "CUST-101",
    name: "João Manhiça",
    email: "joao@amplius.co.mz",
    phone: "+258 84 000 0000",
    company: "Amplius Consulting",
    nuit: "400987654",
    status: "Ativo",
    createdAt: "12 Mar 2026",
  },
  {
    id: "CUST-102",
    name: "Luísa Muianga",
    email: "luisa@kayacolectivo.com",
    phone: "+258 82 111 0000",
    company: "Kaya Colectivo",
    nuit: "400123789",
    status: "Ativo",
    createdAt: "02 Abr 2026",
  },
  {
    id: "CUST-103",
    name: "Carlos Tembe",
    email: "carlos@castel.co.mz",
    phone: "+258 84 555 0000",
    company: "Hotel Castel",
    nuit: "400876543",
    status: "Ativo",
    createdAt: "18 Abr 2026",
  },
  {
    id: "CUST-104",
    name: "Ana Rafael",
    email: "ana@clinica-mg.co.mz",
    phone: "+258 86 222 0000",
    company: "Clínica Maputo",
    nuit: "400234567",
    status: "Suspenso",
    createdAt: "09 Mai 2026",
  },
];

const RELATION_POOLS: Record<RelatedKind, RelatedRow[]> = {
  Pedidos: [
    { id: "IDM-1093", title: "Loja Online E-commerce", meta: "01 Set 2026 · Fase inicial", status: "Em progresso", value: "85 000 MT" },
    { id: "IDM-1092", title: "Business Website", meta: "28 Ago 2026", status: "Pago", value: "55 000 MT" },
    { id: "IDM-1087", title: "Hosting Business (1 ano)", meta: "15 Ago 2026", status: "Pago", value: "9 990 MT" },
    { id: "IDM-1080", title: "Domínio .com — 1 ano", meta: "20 Jul 2026", status: "Ativo", value: "900 MT" },
  ],
  Pagamentos: [
    { id: "PAY-2048", title: "Business Website", meta: "M-Pesa · 01 Set 2026", status: "Pago", value: "55 000 MT" },
    { id: "PAY-2047", title: "Hosting Business (1 ano)", meta: "Visa •••• 4242 · 15 Ago 2026", status: "Pago", value: "9 990 MT" },
    { id: "PAY-2039", title: "Domínio .com", meta: "e-Mola · 20 Jul 2026", status: "Pago", value: "900 MT" },
  ],
  Domínios: [
    { id: "DOM-0031", title: "amplius.co.mz", meta: "Registo · expira 30 Jan 2027", status: "Ativo", value: ".co.mz" },
    { id: "DOM-0029", title: "kayacolectivo.com", meta: "Registo · expira 18 Fev 2027", status: "Ativo", value: ".com" },
    { id: "DOM-0018", title: "company.co.mz", meta: "Renovação · expira 12 Mar 2027", status: "Ativo", value: ".co.mz" },
  ],
  Hosting: [
    { id: "HST-011", title: "Business", meta: "30 GB NVMe · 10 sites", status: "Ativo", value: "9 990 MT/ano" },
    { id: "HST-009", title: "Email 50", meta: "50 mailboxes", status: "Ativo", value: "4 990 MT/ano" },
    { id: "HST-007", title: "Pro", meta: "100 GB NVMe · ilimitado", status: "Ativo", value: "19 990 MT/ano" },
  ],
  Projetos: [
    { id: "PRJ-1009", title: "Website Corporativo", meta: "Design → Página inicial", status: "Em progresso", value: "65%" },
    { id: "PRJ-1008", title: "Loja Online", meta: "Design aprovado", status: "Em progresso", value: "40%" },
    { id: "PRJ-1006", title: "Marca + Website", meta: "Lançado a 02 Jul 2026", status: "Concluído", value: "100%" },
  ],
  Tickets: [
    { id: "TKT-2001", title: "Fatura do domínio .com", meta: "Billing · 03 Set 2026", status: "Aberto", value: "Alta" },
    { id: "TKT-1998", title: "Configurar email profissional", meta: "Suporte técnico · 28 Ago 2026", status: "Resolvido", value: "Normal" },
    { id: "TKT-1995", title: "Relatório do website", meta: "Website · 21 Ago 2026", status: "Em progresso", value: "Normal" },
  ],
};

export const RELATED_KINDS: RelatedKind[] = [
  "Pedidos",
  "Pagamentos",
  "Domínios",
  "Hosting",
  "Projetos",
  "Tickets",
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function relatedFor(customer: AdminCustomer, kind: RelatedKind): RelatedRow[] {
  const pool = RELATION_POOLS[kind];
  const start = hashId(customer.id + kind) % pool.length;
  const count = Math.min(3, pool.length);
  const out: RelatedRow[] = [];
  for (let i = 0; i < count; i++) {
    const row = pool[(start + i) % pool.length];
    if (row) out.push({ ...row, id: `${customer.id}-${row.id}` });
  }
  return out;
}

export const SEED_CATALOG: AdminCatalog = {
  categories: [
    { id: "websites", name: "Websites" },
    { id: "ecommerce", name: "E-commerce" },
    { id: "branding", name: "Branding" },
    { id: "marketing", name: "Search & Marketing" },
    { id: "domains", name: "Domains" },
    { id: "hosting", name: "Hosting" },
    { id: "email", name: "Email" },
    { id: "maintenance", name: "Maintenance" },
  ],
  products: [
    { id: "ITM-1", name: "Starter Website", category: "websites", price: 25000, period: "pagamento único", features: ["domínio", "hosting", "até 5 páginas", "responsive", "SSL", "WhatsApp", "contact form", "basic SEO"], active: true },
    { id: "ITM-2", name: "Business Website", category: "websites", price: 55000, period: "pagamento único", features: ["domínio", "hosting", "até 15 páginas", "custom design", "SEO", "analytics", "Google integration", "professional email"], active: true },
    { id: "ITM-3", name: "E-commerce", category: "ecommerce", price: 85000, period: "pagamento único", features: ["loja online", "produtos", "categorias", "pagamentos", "WhatsApp", "order management", "analytics", "SEO"], active: true },
    { id: "ITM-4", name: "Domínio .com", category: "domains", price: 900, period: "/ ano", features: ["WHOIS privacy", "DNS management"], active: true },
    { id: "ITM-5", name: "Domínio .co.mz", category: "domains", price: 1200, period: "/ ano", features: ["presença local", "registro nacional"], active: true },
    { id: "ITM-6", name: "Hosting Business", category: "hosting", price: 999, period: "/ mês", features: ["30 GB NVMe", "10 websites", "email ilimitado", "SSL"], active: true },
    { id: "ITM-7", name: "Professional Email", category: "email", price: 499, period: "/ mês", features: ["10 GB por caixa", "webmail + IMAP", "anti-spam", "SSL"], active: true },
  ],
  plans: [
    { id: "PLN-1", name: "Starter Website", category: "websites", price: 25000, period: "pagamento único", features: ["5 páginas", "responsive", "SSL", "formulário"], active: true },
    { id: "PLN-2", name: "Business Website", category: "websites", price: 55000, period: "pagamento único", features: ["15 páginas", "SEO", "analytics", "email"], active: true },
    { id: "PLN-3", name: "E-commerce", category: "ecommerce", price: 85000, period: "pagamento único", features: ["loja", "pagamentos", "gestão de pedidos"], active: true },
    { id: "PLN-4", name: "Brand Essentials", category: "branding", price: 30000, period: "pagamento único", features: ["logo", "paleta", "tipografia"], active: true },
    { id: "PLN-5", name: "SEO", category: "marketing", price: 12000, period: "/ mês", features: ["auditoria", "palavras-chave", "relatórios"], active: true },
    { id: "PLN-6", name: "Digital Marketing", category: "marketing", price: 15000, period: "/ mês", features: ["redes sociais", "conteúdo", "campanhas"], active: true },
  ],
  coupons: [
    { id: "CPN-1", code: "WELCOME10", percent: 10, active: true },
    { id: "CPN-2", code: "MOZ15", percent: 15, active: true },
    { id: "CPN-3", code: "BLACK25", percent: 25, active: false },
  ],
};

export const SEED_EXTENSIONS: AdminExtension[] = [
  { extension: ".com", register: 900, renewal: 890, transfer: 900, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".co.mz", register: 1200, renewal: 1100, transfer: 1200, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".co", register: 1000, renewal: 980, transfer: 1000, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".org", register: 1200, renewal: 1100, transfer: 1200, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".net", register: 1100, renewal: 1000, transfer: 1100, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".com.mz", register: 1500, renewal: 1400, transfer: 1500, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
];

export const SEED_ADMIN_HOSTING: AdminHostingPlanRow[] = [
  { id: "APL-1", name: "Business", server: "Shared", storage: "30 GB NVMe", websites: "10", emails: "Unlimited", databases: "Unlimited", monthly: 999, annual: 9990, cycle: "annual", status: "Ativo" },
  { id: "APL-2", name: "Pro", server: "Shared", storage: "100 GB NVMe", websites: "Unlimited", emails: "Unlimited", databases: "Unlimited", monthly: 1999, annual: 19990, cycle: "annual", status: "Ativo" },
  { id: "APL-3", name: "WP Growth", server: "WordPress", storage: "40 GB NVMe", websites: "10", emails: "Unlimited", databases: "Unlimited", monthly: 1099, annual: 10990, cycle: "annual", status: "Ativo" },
  { id: "APL-4", name: "VPS 4GB", server: "VPS", storage: "100 GB NVMe", websites: "Unlimited", emails: "Unlimited", databases: "Unlimited", monthly: 5999, annual: 59990, cycle: "annual", status: "Ativo" },
  { id: "APL-5", name: "Reseller 25", server: "Reseller", storage: "100 GB NVMe", websites: "25", emails: "Unlimited", databases: "Unlimited", monthly: 4999, annual: 49990, cycle: "annual", status: "Ativo" },
  { id: "APL-6", name: "Email 50", server: "Email", storage: "50 GB", websites: "—", emails: "50", databases: "—", monthly: 499, annual: 4990, cycle: "annual", status: "Ativo" },
  { id: "APL-7", name: "Email 100", server: "Email", storage: "100 GB", websites: "—", emails: "100", databases: "—", monthly: 899, annual: 8990, cycle: "annual", status: "Suspenso" },
];

export const CUSTOMERS_KEY = "idesign-admin-customers";
export const CATALOG_KEY = "idesign-admin-catalog";
export const EXTENSIONS_KEY = "idesign-admin-extensions";
export const ADMIN_HOSTING_KEY = "idesign-admin-hosting-plans";

export const SERVERS = ["Shared", "WordPress", "Business", "VPS", "Reseller", "Email"];