/*
 * CRM stores (client-side, localStorage) for the internal CRM.
 * Follows the same pattern as manage-stores.ts: types + seeds + helpers.
 */

export type CrmStageId =
  | "lead"
  | "qualified"
  | "proposal"
  | "won"
  | "onboarding"
  | "active"
  | "retention";

export type CrmLead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  status: "new" | "contacted" | "qualified" | "closed";
  potential: number;
  createdAt: string;
};

export type CrmContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  companyId?: string;
  createdAt: string;
};

export type CrmCompany = {
  id: string;
  name: string;
  industry: string;
  location: string;
  website: string;
  email: string;
  phone: string;
  size: string;
};

export type CrmOpportunity = {
  id: string;
  title: string;
  companyId?: string;
  contactId?: string;
  stage: CrmStageId;
  value: number;
  probability: number;
  expectedClose: string;
  owner: string;
  tags: string[];
};

export type CrmProposal = {
  id: string;
  title: string;
  opportunityId?: string;
  companyId?: string;
  value: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  sentAt: string;
};

export type CrmProject = {
  id: string;
  title: string;
  client: string;
  companyId?: string;
  service: string;
  value: number;
  status: "onboarding" | "active" | "paused" | "completed";
  progress: number;
  start: string;
};

export type CrmCommunication = {
  id: string;
  type: "call" | "email" | "meeting" | "whatsapp";
  direction: "in" | "out";
  subject: string;
  date: string;
  summary: string;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
};

export type CrmNote = {
  id: string;
  text: string;
  createdAt: string;
  author: string;
  companyId?: string;
  contactId?: string;
  leadId?: string;
};

export const CRM_STAGES: CrmStageId[] = [
  "lead",
  "qualified",
  "proposal",
  "won",
  "onboarding",
  "active",
  "retention",
];

export const STAGE_LABEL: Record<CrmStageId, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  onboarding: "Onboarding",
  active: "Active Customer",
  retention: "Retention",
};

export const LEAD_SOURCES = ["Website", "Google Ads", "Referência", "Instagram", "Feira", "Email", "WhatsApp"];

export const COMMUNICATION_TYPES: CrmCommunication["type"][] = ["call", "email", "meeting", "whatsapp"];

/* ------------------------------- Seeds ------------------------------ */

export const SEED_COMPANIES: CrmCompany[] = [
  { id: "COMP-1", name: "Amplius Consulting", industry: "Consultoria", location: "Maputo", website: "amplius.co.mz", email: "info@amplius.co.mz", phone: "+258 84 000 0000", size: "10–50" },
  { id: "COMP-2", name: "Kaya Colectivo", industry: "Café", location: "Maputo", website: "kayacolectivo.com", email: "ola@kayacolectivo.com", phone: "+258 82 111 0000", size: "1–10" },
  { id: "COMP-3", name: "Hotel Castel", industry: "Hotelaria", location: "Maputo", website: "castel.co.mz", email: "reservas@castel.co.mz", phone: "+258 84 555 0000", size: "50–200" },
  { id: "COMP-4", name: "Clínica Maputo Care", industry: "Saúde", location: "Matola", website: "clinica-mg.co.mz", email: "geral@clinica-mg.co.mz", phone: "+258 86 222 0000", size: "10–50" },
  { id: "COMP-5", name: "Moz Foods Distribuição", industry: "Distribuição", location: "Beira", website: "mozfoods.co.mz", email: "vendas@mozfoods.co.mz", phone: "+258 82 333 0000", size: "50–200" },
  { id: "COMP-6", name: "Nhamussua Imóveis", industry: "Imobiliário", location: "Maputo", website: "nhamussua.co.mz", email: "contacto@nhamussua.co.mz", phone: "+258 84 777 0000", size: "1–10" },
];

export const SEED_LEADS: CrmLead[] = [
  { id: "LEAD-1001", name: "Elsa Cossa", company: "MozSKY Agência", email: "elsa@mozsky.co.mz", phone: "+258 86 444 0001", source: "Website", status: "new", potential: 55000, createdAt: "28 Ago 2026" },
  { id: "LEAD-1002", name: "Dário Mabanze", company: "Porto da Beira Cargo", email: "dario@portocargo.mz", phone: "+258 82 555 0002", source: "Google Ads", status: "contacted", potential: 85000, createdAt: "25 Ago 2026" },
  { id: "LEAD-1003", name: "Sónia Uamusse", company: "Restaurante Costa do Sol", email: "sonia@costaosol.mz", phone: "+258 84 666 0003", source: "Instagram", status: "qualified", potential: 30000, createdAt: "20 Ago 2026" },
  { id: "LEAD-1004", name: "Benvindo Macuácua", company: "Jacarandá Hotel", email: "benvindo@jacaranda.mz", phone: "+258 86 777 0004", source: "Referência", status: "new", potential: 120000, createdAt: "18 Ago 2026" },
  { id: "LEAD-1005", name: "Cátia Nhabangue", company: "Terras d'África Tours", email: "catia@terrasafrica.mz", phone: "+258 82 888 0005", source: "Email", status: "contacted", potential: 45000, createdAt: "15 Ago 2026" },
  { id: "LEAD-1006", name: "Adil Chapo", company: "Lojão Online", email: "adil@lojaon.co.mz", phone: "+258 84 999 0006", source: "Google Ads", status: "new", potential: 85000, createdAt: "10 Ago 2026" },
];

export const SEED_CONTACTS: CrmContact[] = [
  { id: "CONT-1", name: "João Manhiça", email: "joao@amplius.co.mz", phone: "+258 84 000 0000", role: "Sócio-gerente", companyId: "COMP-1", createdAt: "12 Mar 2026" },
  { id: "CONT-2", name: "Luísa Muianga", email: "luisa@kayacolectivo.com", phone: "+258 82 111 0000", role: "Fundadora", companyId: "COMP-2", createdAt: "02 Abr 2026" },
  { id: "CONT-3", name: "Carlos Tembe", email: "carlos@castel.co.mz", phone: "+258 84 555 0000", role: "Diretor de operações", companyId: "COMP-3", createdAt: "18 Abr 2026" },
  { id: "CONT-4", name: "Ana Rafael", email: "ana@clinica-mg.co.mz", phone: "+258 86 222 0000", role: "Administradora", companyId: "COMP-4", createdAt: "09 Mai 2026" },
  { id: "CONT-5", name: "Osvaldo Muandoa", email: "osvaldo@mozfoods.co.mz", phone: "+258 82 333 0000", role: "Responsável de marketing", companyId: "COMP-5", createdAt: "22 Mai 2026" },
  { id: "CONT-6", name: "Iva Chongo", email: "iva@nhamussua.co.mz", phone: "+258 84 777 0000", role: "Gestora de imóveis", companyId: "COMP-6", createdAt: "01 Jun 2026" },
];

export const SEED_OPPORTUNITIES: CrmOpportunity[] = [
  { id: "OPP-3001", title: "Website corporativo + hosting", companyId: "COMP-1", contactId: "CONT-1", stage: "active", value: 55000, probability: 100, expectedClose: "—", owner: "IDesign", tags: ["website"] },
  { id: "OPP-3002", title: "Loja online + domínio .com", companyId: "COMP-2", contactId: "CONT-2", stage: "onboarding", value: 85000, probability: 100, expectedClose: "30 Set 2026", owner: "IDesign", tags: ["ecommerce", "domain"] },
  { id: "OPP-3003", title: "Renovação marca + website", companyId: "COMP-3", contactId: "CONT-3", stage: "retention", value: 30000, probability: 100, expectedClose: "—", owner: "IDesign", tags: ["branding"] },
  { id: "OPP-3004", title: "SEO mensal healthcare", companyId: "COMP-4", contactId: "CONT-4", stage: "won", value: 12000, probability: 100, expectedClose: "15 Set 2026", owner: "IDesign", tags: ["seo"] },
  { id: "OPP-3005", title: "Plataforma distribuição", companyId: "COMP-5", contactId: "CONT-5", stage: "proposal", value: 150000, probability: 60, expectedClose: "30 Out 2026", owner: "IDesign", tags: ["website", "ecommerce"] },
  { id: "OPP-3006", title: "Portal imobiliário", companyId: "COMP-6", contactId: "CONT-6", stage: "qualified", value: 90000, probability: 40, expectedClose: "30 Nov 2026", owner: "IDesign", tags: ["website"] },
  { id: "OPP-3007", title: "Website agência de viagens", companyId: undefined, contactId: undefined, stage: "lead", value: 45000, probability: 20, expectedClose: "Dez 2026", owner: "IDesign", tags: ["website"] },
];

export const SEED_PROPOSALS: CrmProposal[] = [
  { id: "PROP-4001", title: "Proposta — Plataforma distribuição", opportunityId: "OPP-3005", companyId: "COMP-5", value: 150000, status: "sent", sentAt: "28 Ago 2026" },
  { id: "PROP-4002", title: "Proposta — Portal imobiliário", opportunityId: "OPP-3006", companyId: "COMP-6", value: 90000, status: "draft", sentAt: "—" },
  { id: "PROP-4003", title: "Proposta — SEO healthcare", opportunityId: "OPP-3004", companyId: "COMP-4", value: 12000, status: "accepted", sentAt: "10 Set 2026" },
  { id: "PROP-4004", title: "Proposta — E-commerce Kaya", opportunityId: "OPP-3002", companyId: "COMP-2", value: 85000, status: "accepted", sentAt: "05 Set 2026" },
];

export const SEED_CRM_PROJECTS: CrmProject[] = [
  { id: "CRM-PRJ-501", title: "Website corporativo", client: "Amplius Consulting", companyId: "COMP-1", service: "Business Website", value: 55000, status: "completed", progress: 100, start: "02 Set 2026" },
  { id: "CRM-PRJ-502", title: "Loja online", client: "Kaya Colectivo", companyId: "COMP-2", service: "E-commerce", value: 85000, status: "active", progress: 45, start: "08 Set 2026" },
  { id: "CRM-PRJ-503", title: "SEO healthcare", client: "Clínica Maputo Care", companyId: "COMP-4", service: "SEO", value: 12000, status: "onboarding", progress: 15, start: "12 Set 2026" },
  { id: "CRM-PRJ-504", title: "Redesign marca", client: "Hotel Castel", companyId: "COMP-3", service: "Branding", value: 30000, status: "completed", progress: 100, start: "20 Jul 2026" },
];

export const SEED_COMMUNICATIONS: CrmCommunication[] = [
  { id: "COMM-601", type: "call", direction: "out", subject: "Follow-up proposta", date: "02 Set 2026", summary: "Cliente terminou de rever; pretende negociar prazo.", companyId: "COMP-6", contactId: "CONT-6", opportunityId: "OPP-3006" },
  { id: "COMM-602", type: "email", direction: "in", subject: "Envio de documentos", date: "01 Set 2026", summary: "Requisitos da plataforma e prazos desejados.", companyId: "COMP-5", contactId: "CONT-5", opportunityId: "OPP-3005" },
  { id: "COMM-603", type: "meeting", direction: "out", subject: "Kickoff e-commerce", date: "08 Set 2026", summary: "Sessão de lançamento, entregues credenciais e roadmap.", companyId: "COMP-2", contactId: "CONT-2", opportunityId: "OPP-3002" },
  { id: "COMM-604", type: "whatsapp", direction: "in", subject: "Aprovação SEO", date: "10 Set 2026", summary: "Aceite verbal da proposta SEO.", companyId: "COMP-4", contactId: "CONT-4", opportunityId: "OPP-3004" },
];

export const SEED_NOTES: CrmNote[] = [
  { id: "NOTE-701", text: "Prefere contactos via WhatsApp; sensível a prazos.", createdAt: "28 Ago 2026", author: "IDesign", contactId: "CONT-6" },
  { id: "NOTE-702", text: "Orçamento anual aprovado até 200k MT para digital.", createdAt: "01 Set 2026", author: "IDesign", companyId: "COMP-5" },
  { id: "NOTE-703", text: "Pediu demonstração de gestão de pedidos.", createdAt: "04 Set 2026", author: "IDesign", contactId: "CONT-2" },
  { id: "NOTE-704", text: "Renovar domínio em Outubro — colocou lembrete.", createdAt: "20 Ago 2026", author: "IDesign", companyId: "COMP-3" },
];

/* --------------------------------- Keys -------------------------------- */

export const CRM_COMPANIES_KEY = "idesign-crm-companies";
export const CRM_LEADS_KEY = "idesign-crm-leads";
export const CRM_CONTACTS_KEY = "idesign-crm-contacts";
export const CRM_OPPORTUNITIES_KEY = "idesign-crm-opportunities";
export const CRM_PROPOSALS_KEY = "idesign-crm-proposals";
export const CRM_PROJECTS_KEY = "idesign-crm-projects";
export const CRM_COMMUNICATIONS_KEY = "idesign-crm-communications";
export const CRM_NOTES_KEY = "idesign-crm-notes";