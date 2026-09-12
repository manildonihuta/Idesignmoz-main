/*
 * CRM types + pure helpers for the internal CRM views.
 *
 * Data is read from / written to the database via `/api/admin/store/[kind]`
 * (server-side, `site_settings`), NOT localStorage. This module only holds
 * the record shapes and option pools used by the views. Seed data lives in
 * `scripts/seed-admin-stores.test.ts`.
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