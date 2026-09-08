import type { Role } from "@/lib/security/rbac";
import type { NotificationPayload, RenderedNotification } from "./types";

function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMT(value: unknown): string {
  return typeof value === "number" ? `${value.toLocaleString("pt-PT")} MT` : escapeHtml(value ?? "");
}

const ADMIN_LINK = "/admin";

export type NotificationEventDef = {
  key: string;
  label: string;
  roles: readonly Role[];
  render: (payload: NotificationPayload) => RenderedNotification;
};

export const EVENTS = {
  "payment.successful": {
    key: "payment.successful",
    label: "Pagamento recebido",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "payment.successful",
      title: `Pagamento recebido — ${escapeHtml(p.fullDomain)}`,
      body: `O pagamento do domínio ${escapeHtml(p.fullDomain)} foi confirmado.${
        p.price != null ? ` Valor: ${fmtMT(p.price)}.` : ""
      }`,
      link: ADMIN_LINK,
    }),
  },
  "domain.registered": {
    key: "domain.registered",
    label: "Domínio registado",
    roles: ["super_admin", "admin", "manager", "sales", "developer"],
    render: (p) => ({
      key: "domain.registered",
      title: `Domínio registado — ${escapeHtml(p.fullDomain)}`,
      body: `O domínio ${escapeHtml(p.fullDomain)} foi registado${
        p.years ? ` por ${escapeHtml(p.years)} ${p.years === 1 ? "ano" : "anos"}` : ""
      }.`,
      link: ADMIN_LINK,
    }),
  },
  "domain.expiring": {
    key: "domain.expiring",
    label: "Domínio a expirar",
    roles: ["super_admin", "admin", "manager", "developer", "support"],
    render: (p) => ({
      key: "domain.expiring",
      title: `Domínio a expirar — ${escapeHtml(p.fullDomain)}`,
      body: `O domínio ${escapeHtml(p.fullDomain)} expira em ${escapeHtml(p.daysLeft)} dias (${
        escapeHtml(p.expiresAt)
      }). Renova para evitar a perda do domínio.`,
      link: ADMIN_LINK,
    }),
  },
  "domain.expiring.30": {
    key: "domain.expiring.30",
    label: "Domínio a expirar (30 dias)",
    roles: ["super_admin", "admin", "manager", "developer", "support"],
    render: (p) => ({
      key: "domain.expiring.30",
      title: `Domínio a expirar — ${escapeHtml(p.fullDomain)}`,
      body: `O domínio ${escapeHtml(p.fullDomain)} expira em ${escapeHtml(
        p.daysLeft,
      )} dias (${escapeHtml(p.expiresAt)}). Renova a tempo para evitar a perda do domínio.${
        p.renewalPrice != null ? ` Renovação: ${fmtMT(p.renewalPrice)}.` : ""
      }`,
      link: ADMIN_LINK,
    }),
  },
  "domain.expiring.15": {
    key: "domain.expiring.15",
    label: "Domínio a expirar (15 dias)",
    roles: ["super_admin", "admin", "manager", "developer", "support"],
    render: (p) => ({
      key: "domain.expiring.15",
      title: `Lembrete — domínio a expirar`,
      body: `O domínio ${escapeHtml(p.fullDomain)} expira em ${escapeHtml(p.daysLeft)} dias (${escapeHtml(
        p.expiresAt,
      )}). Renova agora para não interromper o serviço.${
        p.renewalPrice != null ? ` Renovação: ${fmtMT(p.renewalPrice)}.` : ""
      }`,
      link: ADMIN_LINK,
    }),
  },
  "domain.expiring.7": {
    key: "domain.expiring.7",
    label: "Domínio a expirar (urgente)",
    roles: ["super_admin", "admin", "manager", "developer", "support"],
    render: (p) => ({
      key: "domain.expiring.7",
      title: `⚠️ Urgente — domínio a expirar`,
      body: `O domínio ${escapeHtml(p.fullDomain)} expira em ${escapeHtml(p.daysLeft)} dias (${escapeHtml(
        p.expiresAt,
      )}). A renovação é urgente para evitar a perda do domínio.${
        p.renewalPrice != null ? ` Renovação: ${fmtMT(p.renewalPrice)}.` : ""
      }`,
      link: ADMIN_LINK,
    }),
  },
  "domain.expiring.1": {
    key: "domain.expiring.1",
    label: "Domínio a expirar (último dia)",
    roles: ["super_admin", "admin", "manager", "developer", "support"],
    render: (p) => ({
      key: "domain.expiring.1",
      title: `🚨 Última chamada — domínio a expirar`,
      body: `O domínio ${escapeHtml(p.fullDomain)} expira amanhã (${escapeHtml(
        p.expiresAt,
      )}). Este é o último aviso antes da perda do domínio.${
        p.renewalPrice != null ? ` Renovação: ${fmtMT(p.renewalPrice)}.` : ""
      }`,
      link: ADMIN_LINK,
    }),
  },
  "domain.autoRenewed": {
    key: "domain.autoRenewed",
    label: "Renovação automática preparada",
    roles: ["super_admin", "admin", "manager", "developer", "support"],
    render: (p) => ({
      key: "domain.autoRenewed",
      title: `Renovação automática — ${escapeHtml(p.fullDomain)}`,
      body: `A renovação automática do domínio ${escapeHtml(p.fullDomain)} foi preparada.${
        p.renewalPrice != null ? ` Preço da renovação: ${fmtMT(p.renewalPrice)}.` : ""
      }`,
      link: ADMIN_LINK,
    }),
  },
  "hosting.activated": {
    key: "hosting.activated",
    label: "Alojamento ativado",
    roles: ["super_admin", "admin", "manager", "developer"],
    render: (p) => ({
      key: "hosting.activated",
      title: `Alojamento ativado — ${escapeHtml(p.domain)}`,
      body: `O alojamento ${escapeHtml(p.planName)} de ${escapeHtml(p.domain)} foi ativado.`,
      link: ADMIN_LINK,
    }),
  },
  "subscription.created": {
    key: "subscription.created",
    label: "Subscrição criada",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "subscription.created",
      title: "Subscrição criada",
      body: `Nova subscrição ${escapeHtml(p.kind)} criada${
        p.period ? ` com facturação ${escapeHtml(p.period)}` : ""
      }.${p.price != null ? ` Valor: ${fmtMT(p.price)}.` : ""}`,
      link: ADMIN_LINK,
    }),
  },
  "subscription.past_due": {
    key: "subscription.past_due",
    label: "Subscrição em atraso",
    roles: ["super_admin", "admin", "manager", "sales", "support"],
    render: (p) => ({
      key: "subscription.past_due",
      title: "Subscrição em atraso",
      body: `A subscrição${
        p.kind ? ` de ${escapeHtml(p.kind)}` : ""
      } atingiu a data de renovação sem pagamento. Entra no período de tolerância.`,
      link: ADMIN_LINK,
    }),
  },
  "subscription.suspended": {
    key: "subscription.suspended",
    label: "Subscrição suspensa",
    roles: ["super_admin", "admin", "manager", "support"],
    render: () => ({
      key: "subscription.suspended",
      title: "Subscrição suspensa",
      body: "Uma subscrição foi suspensa por falta de pagamento após o período de tolerância.",
      link: ADMIN_LINK,
    }),
  },
  "subscription.terminated": {
    key: "subscription.terminated",
    label: "Subscrição terminada",
    roles: ["super_admin", "admin", "manager"],
    render: () => ({
      key: "subscription.terminated",
      title: "Subscrição terminada",
      body: "Uma subscrição foi terminada após o período de suspensão.",
      link: ADMIN_LINK,
    }),
  },
  "invoice.created": {
    key: "invoice.created",
    label: "Fatura criada",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "invoice.created",
      title: `Fatura criada — ${escapeHtml(p.number)}`,
      body: `Fatura ${escapeHtml(p.number)} emitida${p.total != null ? ` no valor de ${fmtMT(p.total)}` : ""}.`,
      link: ADMIN_LINK,
    }),
  },
  "ticket.updated": {
    key: "ticket.updated",
    label: "Ticket atualizado",
    roles: ["super_admin", "admin", "manager", "support"],
    render: (p) => ({
      key: "ticket.updated",
      title: `Ticket atualizado — ${escapeHtml(p.number)}`,
      body: `O ticket ${escapeHtml(p.number)} foi atualizado.`,
      link: ADMIN_LINK,
    }),
  },
  "project.approved": {
    key: "project.approved",
    label: "Projeto aprovado",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "project.approved",
      title: `Projeto aprovado — ${escapeHtml(p.title)}`,
      body: `O projeto ${escapeHtml(p.title)} foi aprovado.`,
      link: ADMIN_LINK,
    }),
  },
  "website.brief": {
    key: "website.brief",
    label: "Novo briefing de website",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "website.brief",
      title: `Briefing — ${escapeHtml(p.package ?? "")}`,
      body: `${escapeHtml(p.clientName ?? "")}${p.company ? ` (${escapeHtml(p.company)})` : ""} submeteu um briefing para ${escapeHtml(
        p.package ?? "",
      )}.${p.total != null ? ` Orçamento: ${fmtMT(p.total)}.` : ""}`,
      link: ADMIN_LINK,
    }),
  },
  "project.activated": {
    key: "project.activated",
    label: "Projeto ativado",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "project.activated",
      title: `Projeto ativado — ${escapeHtml(p.title)}`,
      body: `O projeto ${escapeHtml(p.title)} foi aprovado e entrou em execução.`,
      link: ADMIN_LINK,
    }),
  },
  "proposal.approved": {
    key: "proposal.approved",
    label: "Proposta aprovada",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "proposal.approved",
      title: `Proposta aprovada — ${escapeHtml(p.code)}`,
      body: `${p.clientName ? `${escapeHtml(p.clientName)} aceitou` : "O cliente aceitou"} a proposta ${escapeHtml(
        p.code,
      )}.${p.total != null ? ` Valor: ${fmtMT(p.total)}.` : ""}`,
      link: ADMIN_LINK,
    }),
  },
  "ai_site.generated": {
    key: "ai_site.generated",
    label: "Website gerado por IA",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "ai_site.generated",
      title: `Website gerado por IA — ${escapeHtml(p.businessName)}`,
      body: `Um cliente gerou um website com IA para ${escapeHtml(p.businessName)}.`,
      link: ADMIN_LINK,
    }),
  },
  "ai_site.published": {
    key: "ai_site.published",
    label: "Website IA publicado",
    roles: ["super_admin", "admin", "manager", "sales"],
    render: (p) => ({
      key: "ai_site.published",
      title: `Website IA publicado — ${escapeHtml(p.businessName)}`,
      body: `O website IA de ${escapeHtml(p.businessName)} foi publicado e está online.`,
      link: ADMIN_LINK,
    }),
  },
} as const satisfies Record<string, NotificationEventDef>;

export type EventKey = keyof typeof EVENTS;