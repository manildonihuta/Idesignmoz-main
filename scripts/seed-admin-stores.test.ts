import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/* --------------------------------------------------------------------- *
 * Seeds the admin/CRM stores into `public.site_settings` (DB-backed admin,
 * replacing the old localStorage stores). Idempotent — safe to re-run.
 * Store keys match `src/services/admin-store.service.ts`.
 * --------------------------------------------------------------------- */

const adminCustomers = [
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

const adminCatalog = {
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

const adminExtensions = [
  { extension: ".com", register: 900, renewal: 890, transfer: 900, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".co.mz", register: 1200, renewal: 1100, transfer: 1200, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".co", register: 1000, renewal: 980, transfer: 1000, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".org", register: 1200, renewal: 1100, transfer: 1200, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".net", register: 1100, renewal: 1000, transfer: 1100, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
  { extension: ".com.mz", register: 1500, renewal: 1400, transfer: 1500, available: true, suspended: false, expires: "30 Jan 2027", renewCount: 0 },
];

const adminHosting = [
  { id: "APL-1", name: "Business", server: "Shared", storage: "30 GB NVMe", websites: "10", emails: "Unlimited", databases: "Unlimited", monthly: 999, annual: 9990, cycle: "annual", status: "Ativo" },
  { id: "APL-2", name: "Pro", server: "Shared", storage: "100 GB NVMe", websites: "Unlimited", emails: "Unlimited", databases: "Unlimited", monthly: 1999, annual: 19990, cycle: "annual", status: "Ativo" },
  { id: "APL-3", name: "WP Growth", server: "WordPress", storage: "40 GB NVMe", websites: "10", emails: "Unlimited", databases: "Unlimited", monthly: 1099, annual: 10990, cycle: "annual", status: "Ativo" },
  { id: "APL-4", name: "VPS 4GB", server: "VPS", storage: "100 GB NVMe", websites: "Unlimited", emails: "Unlimited", databases: "Unlimited", monthly: 5999, annual: 59990, cycle: "annual", status: "Ativo" },
  { id: "APL-5", name: "Reseller 25", server: "Reseller", storage: "100 GB NVMe", websites: "25", emails: "Unlimited", databases: "Unlimited", monthly: 4999, annual: 49990, cycle: "annual", status: "Ativo" },
  { id: "APL-6", name: "Email 50", server: "Email", storage: "50 GB", websites: "—", emails: "50", databases: "—", monthly: 499, annual: 4990, cycle: "annual", status: "Ativo" },
  { id: "APL-7", name: "Email 100", server: "Email", storage: "100 GB", websites: "—", emails: "100", databases: "—", monthly: 899, annual: 8990, cycle: "annual", status: "Suspenso" },
];

const crmCompanies = [
  { id: "COMP-1", name: "Amplius Consulting", industry: "Consultoria", location: "Maputo", website: "amplius.co.mz", email: "info@amplius.co.mz", phone: "+258 84 000 0000", size: "10–50" },
  { id: "COMP-2", name: "Kaya Colectivo", industry: "Café", location: "Maputo", website: "kayacolectivo.com", email: "ola@kayacolectivo.com", phone: "+258 82 111 0000", size: "1–10" },
  { id: "COMP-3", name: "Hotel Castel", industry: "Hotelaria", location: "Maputo", website: "castel.co.mz", email: "reservas@castel.co.mz", phone: "+258 84 555 0000", size: "50–200" },
  { id: "COMP-4", name: "Clínica Maputo Care", industry: "Saúde", location: "Matola", website: "clinica-mg.co.mz", email: "geral@clinica-mg.co.mz", phone: "+258 86 222 0000", size: "10–50" },
  { id: "COMP-5", name: "Moz Foods Distribuição", industry: "Distribuição", location: "Beira", website: "mozfoods.co.mz", email: "vendas@mozfoods.co.mz", phone: "+258 82 333 0000", size: "50–200" },
  { id: "COMP-6", name: "Nhamussua Imóveis", industry: "Imobiliário", location: "Maputo", website: "nhamussua.co.mz", email: "contacto@nhamussua.co.mz", phone: "+258 84 777 0000", size: "1–10" },
];

const crmLeads = [
  { id: "LEAD-1001", name: "Elsa Cossa", company: "MozSKY Agência", email: "elsa@mozsky.co.mz", phone: "+258 86 444 0001", source: "Website", status: "new", potential: 55000, createdAt: "28 Ago 2026" },
  { id: "LEAD-1002", name: "Dário Mabanze", company: "Porto da Beira Cargo", email: "dario@portocargo.mz", phone: "+258 82 555 0002", source: "Google Ads", status: "contacted", potential: 85000, createdAt: "25 Ago 2026" },
  { id: "LEAD-1003", name: "Sónia Uamusse", company: "Restaurante Costa do Sol", email: "sonia@costaosol.mz", phone: "+258 84 666 0003", source: "Instagram", status: "qualified", potential: 30000, createdAt: "20 Ago 2026" },
  { id: "LEAD-1004", name: "Benvindo Macuácua", company: "Jacarandá Hotel", email: "benvindo@jacaranda.mz", phone: "+258 86 777 0004", source: "Referência", status: "new", potential: 120000, createdAt: "18 Ago 2026" },
  { id: "LEAD-1005", name: "Cátia Nhabangue", company: "Terras d'África Tours", email: "catia@terrasafrica.mz", phone: "+258 82 888 0005", source: "Email", status: "contacted", potential: 45000, createdAt: "15 Ago 2026" },
  { id: "LEAD-1006", name: "Adil Chapo", company: "Lojão Online", email: "adil@lojaon.co.mz", phone: "+258 84 999 0006", source: "Google Ads", status: "new", potential: 85000, createdAt: "10 Ago 2026" },
];

const crmContacts = [
  { id: "CONT-1", name: "João Manhiça", email: "joao@amplius.co.mz", phone: "+258 84 000 0000", role: "Sócio-gerente", companyId: "COMP-1", createdAt: "12 Mar 2026" },
  { id: "CONT-2", name: "Luísa Muianga", email: "luisa@kayacolectivo.com", phone: "+258 82 111 0000", role: "Fundadora", companyId: "COMP-2", createdAt: "02 Abr 2026" },
  { id: "CONT-3", name: "Carlos Tembe", email: "carlos@castel.co.mz", phone: "+258 84 555 0000", role: "Diretor de operações", companyId: "COMP-3", createdAt: "18 Abr 2026" },
  { id: "CONT-4", name: "Ana Rafael", email: "ana@clinica-mg.co.mz", phone: "+258 86 222 0000", role: "Administradora", companyId: "COMP-4", createdAt: "09 Mai 2026" },
  { id: "CONT-5", name: "Osvaldo Muandoa", email: "osvaldo@mozfoods.co.mz", phone: "+258 82 333 0000", role: "Responsável de marketing", companyId: "COMP-5", createdAt: "22 Mai 2026" },
  { id: "CONT-6", name: "Iva Chongo", email: "iva@nhamussua.co.mz", phone: "+258 84 777 0000", role: "Gestora de imóveis", companyId: "COMP-6", createdAt: "01 Jun 2026" },
];

const crmOpportunities = [
  { id: "OPP-3001", title: "Website corporativo + hosting", companyId: "COMP-1", contactId: "CONT-1", stage: "active", value: 55000, probability: 100, expectedClose: "—", owner: "IDesign", tags: ["website"] },
  { id: "OPP-3002", title: "Loja online + domínio .com", companyId: "COMP-2", contactId: "CONT-2", stage: "onboarding", value: 85000, probability: 100, expectedClose: "30 Set 2026", owner: "IDesign", tags: ["ecommerce", "domain"] },
  { id: "OPP-3003", title: "Renovação marca + website", companyId: "COMP-3", contactId: "CONT-3", stage: "retention", value: 30000, probability: 100, expectedClose: "—", owner: "IDesign", tags: ["branding"] },
  { id: "OPP-3004", title: "SEO mensal healthcare", companyId: "COMP-4", contactId: "CONT-4", stage: "won", value: 12000, probability: 100, expectedClose: "15 Set 2026", owner: "IDesign", tags: ["seo"] },
  { id: "OPP-3005", title: "Plataforma distribuição", companyId: "COMP-5", contactId: "CONT-5", stage: "proposal", value: 150000, probability: 60, expectedClose: "30 Out 2026", owner: "IDesign", tags: ["website", "ecommerce"] },
  { id: "OPP-3006", title: "Portal imobiliário", companyId: "COMP-6", contactId: "CONT-6", stage: "qualified", value: 90000, probability: 40, expectedClose: "30 Nov 2026", owner: "IDesign", tags: ["website"] },
  { id: "OPP-3007", title: "Website agência de viagens", companyId: undefined, contactId: undefined, stage: "lead", value: 45000, probability: 20, expectedClose: "Dez 2026", owner: "IDesign", tags: ["website"] },
];

const crmProposals = [
  { id: "PROP-4001", title: "Proposta — Plataforma distribuição", opportunityId: "OPP-3005", companyId: "COMP-5", value: 150000, status: "sent", sentAt: "28 Ago 2026" },
  { id: "PROP-4002", title: "Proposta — Portal imobiliário", opportunityId: "OPP-3006", companyId: "COMP-6", value: 90000, status: "draft", sentAt: "—" },
  { id: "PROP-4003", title: "Proposta — SEO healthcare", opportunityId: "OPP-3004", companyId: "COMP-4", value: 12000, status: "accepted", sentAt: "10 Set 2026" },
  { id: "PROP-4004", title: "Proposta — E-commerce Kaya", opportunityId: "OPP-3002", companyId: "COMP-2", value: 85000, status: "accepted", sentAt: "05 Set 2026" },
];

const crmProjects = [
  { id: "CRM-PRJ-501", title: "Website corporativo", client: "Amplius Consulting", companyId: "COMP-1", service: "Business Website", value: 55000, status: "completed", progress: 100, start: "02 Set 2026" },
  { id: "CRM-PRJ-502", title: "Loja online", client: "Kaya Colectivo", companyId: "COMP-2", service: "E-commerce", value: 85000, status: "active", progress: 45, start: "08 Set 2026" },
  { id: "CRM-PRJ-503", title: "SEO healthcare", client: "Clínica Maputo Care", companyId: "COMP-4", service: "SEO", value: 12000, status: "onboarding", progress: 15, start: "12 Set 2026" },
  { id: "CRM-PRJ-504", title: "Redesign marca", client: "Hotel Castel", companyId: "COMP-3", service: "Branding", value: 30000, status: "completed", progress: 100, start: "20 Jul 2026" },
];

const crmCommunications = [
  { id: "COMM-601", type: "call", direction: "out", subject: "Follow-up proposta", date: "02 Set 2026", summary: "Cliente terminou de rever; pretende negociar prazo.", companyId: "COMP-6", contactId: "CONT-6", opportunityId: "OPP-3006" },
  { id: "COMM-602", type: "email", direction: "in", subject: "Envio de documentos", date: "01 Set 2026", summary: "Requisitos da plataforma e prazos desejados.", companyId: "COMP-5", contactId: "CONT-5", opportunityId: "OPP-3005" },
  { id: "COMM-603", type: "meeting", direction: "out", subject: "Kickoff e-commerce", date: "08 Set 2026", summary: "Sessão de lançamento, entregues credenciais e roadmap.", companyId: "COMP-2", contactId: "CONT-2", opportunityId: "OPP-3002" },
  { id: "COMM-604", type: "whatsapp", direction: "in", subject: "Aprovação SEO", date: "10 Set 2026", summary: "Aceite verbal da proposta SEO.", companyId: "COMP-4", contactId: "CONT-4", opportunityId: "OPP-3004" },
];

const crmNotes = [
  { id: "NOTE-701", text: "Prefere contactos via WhatsApp; sensível a prazos.", createdAt: "28 Ago 2026", author: "IDesign", contactId: "CONT-6" },
  { id: "NOTE-702", text: "Orçamento anual aprovado até 200k MT para digital.", createdAt: "01 Set 2026", author: "IDesign", companyId: "COMP-5" },
  { id: "NOTE-703", text: "Pediu demonstração de gestão de pedidos.", createdAt: "04 Set 2026", author: "IDesign", contactId: "CONT-2" },
  { id: "NOTE-704", text: "Renovar domínio em Outubro — colocou lembrete.", createdAt: "20 Ago 2026", author: "IDesign", companyId: "COMP-3" },
];

const STORE_ENTRIES: Array<{ key: string; value: unknown }> = [
  { key: "admin_customers", value: adminCustomers },
  { key: "admin_catalog", value: adminCatalog },
  { key: "admin_extensions", value: adminExtensions },
  { key: "admin_hosting", value: adminHosting },
  { key: "crm_companies", value: crmCompanies },
  { key: "crm_leads", value: crmLeads },
  { key: "crm_contacts", value: crmContacts },
  { key: "crm_opportunities", value: crmOpportunities },
  { key: "crm_proposals", value: crmProposals },
  { key: "crm_projects", value: crmProjects },
  { key: "crm_communications", value: crmCommunications },
  { key: "crm_notes", value: crmNotes },
];

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/\\"/g, '"');
      }
      out[m[1]] = val;
    }
  } catch {
    /* .env.local not present */
  }
  return out;
}

describe("seed-admin-stores", () => {
  it("should push all admin/CRM stores to site_settings", async () => {
    const env = loadEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    }
    const supabase = createClient(url, key);

    const { error } = await supabase
      .from("site_settings")
      .upsert(STORE_ENTRIES, { onConflict: "key" });
    expect(error).toBeNull();
  });
});