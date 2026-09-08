import "server-only";

/* --------------------------------------------------------------------- *
 * Platform expansion roadmap.
 *
 * IDesign Moz is built as a modular SaaS platform. The capabilities below
 * are the announced product surface areas for future releases. Each entry
 * is a self-contained "slot": id + metadata + target route. When a feature
 * ships, the owning feature module registers real routes/components here
 * (and toggles `status` to `live`) WITHOUT rebuilding the rest of the
 * platform.
 *
 * The homepage renders these as an extensible grid so the roadmap is
 * visible today and degrades gracefully as features go live.
 * --------------------------------------------------------------------- */

export type FutureFeatureStatus = "planned" | "beta" | "live";

export type FutureFeature = {
  id: string;
  name: string;
  short: string;
  description: string;
  /** Existing route to link to, or a placeholder "#" until shipped. */
  href: string;
  status: FutureFeatureStatus;
  /** Area this feature belongs to (used to group/segment the UI). */
  area: "commerce" | "creators" | "intelligence" | "operations";
};

export const FUTURE_FEATURES: FutureFeature[] = [
  {
    id: "mobile-app",
    name: "Mobile App",
    short: "Gerir tudo a partir do telemóvel",
    description: "Aplicação móvel nativa e PWA para gerir domínios, alojamento e faturação em qualquer lugar.",
    href: "/dashboard",
    status: "planned",
    area: "operations",
  },
  {
    id: "reseller",
    name: "Reseller Platform",
    short: "Venda alojamento e domínios como revendedor",
    description: "Painel de revenda com preços configuráveis para agências e empresários lançarem a sua própria oferta.",
    href: "/contact",
    status: "planned",
    area: "commerce",
  },
  {
    id: "white-label",
    name: "White-Label Hosting",
    short: "Alojamento com a sua marca",
    description: "Infraestrutura e painel white-label para você oferecer serviços sob a sua própria marca.",
    href: "/contact",
    status: "planned",
    area: "commerce",
  },
  {
    id: "affiliate",
    name: "Affiliate System",
    short: "Ganhe comissões por cada cliente",
    description: "Ligações rastreáveis e pagamentos automáticos para parceiros que recomendam a plataforma.",
    href: "/contact",
    status: "planned",
    area: "commerce",
  },
  {
    id: "marketplace",
    name: "Freelancer Marketplace",
    short: "Contrate talento certificado",
    description: "Mercado de freelancers e agências para projetos de web, design e marketing.",
    href: "/contact",
    status: "planned",
    area: "creators",
  },
  {
    id: "website-builder",
    name: "Website Builder",
    short: "Constrói o teu site com arrastar-e-soltar",
    description: "Editor visual de sites com temas prontos, sem escrever código.",
    href: "/websites",
    status: "planned",
    area: "creators",
  },
  {
    id: "ai-website-generator",
    name: "AI Website Generator",
    short: "Gera um site a partir de um prompt",
    description: "Inteligência artificial converte uma descrição num site completo e personalizado.",
    href: "/websites",
    status: "planned",
    area: "intelligence",
  },
  {
    id: "ai-marketing",
    name: "AI Marketing Assistant",
    short: "Copys e campanhas geradas por IA",
    description: "Assistente que cria conteúdo e planeia campanhas para teu negócio.",
    href: "/contact",
    status: "planned",
    area: "intelligence",
  },
  {
    id: "automated-seo",
    name: "Automated SEO",
    short: "Otimização contínua e automática",
    description: "Auditorias, palavras-chave e relatórios de ranking automatizados.",
    href: "/contact",
    status: "planned",
    area: "intelligence",
  },
  {
    id: "customer-crm",
    name: "Customer CRM",
    short: "Conheça e organize seus clientes",
    description: "Gestão de contactos, pipelines e relacionamento num só lugar.",
    href: "/contact",
    status: "planned",
    area: "operations",
  },
  {
    id: "subscriptions",
    name: "Subscription Management",
    short: "Subscrições e renovações automáticas",
    description: "Planos recorrentes, faturação automática e gestão de subscrições no painel.",
    href: "/dashboard/subscriptions",
    status: "beta",
    area: "operations",
  },
];

/** Filter helpers used by the roadmap rendering. */
export function getFutureFeaturesByArea(area: FutureFeature["area"]): FutureFeature[] {
  return FUTURE_FEATURES.filter((f) => f.area === area);
}

export const FUTURE_AREAS: Array<{ id: FutureFeature["area"]; label: string }> = [
  { id: "commerce", label: "Commerce" },
  { id: "creators", label: "For Creators" },
  { id: "intelligence", label: "Intelligence" },
  { id: "operations", label: "Operations" },
];