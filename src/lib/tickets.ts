export type TicketStatus =
  | "Open"
  | "In Progress"
  | "Waiting for Customer"
  | "Resolved"
  | "Closed";

export type TicketPriority = "Low" | "Normal" | "High" | "Critical";

export type TicketCategory =
  | "Billing"
  | "Technical Support"
  | "Website"
  | "Domain"
  | "Hosting"
  | "Other";

export type TicketMessage = {
  id: string;
  author: string;
  text: string;
  date: string;
  attachment?: {
    name: string;
    size: string;
  };
};

export type SupportTicket = {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
};

export const TICKET_STATUSES: TicketStatus[] = [
  "Open",
  "In Progress",
  "Waiting for Customer",
  "Resolved",
  "Closed",
];

export const TICKET_PRIORITIES: TicketPriority[] = [
  "Low",
  "Normal",
  "High",
  "Critical",
];

export const TICKET_CATEGORIES: TicketCategory[] = [
  "Billing",
  "Technical Support",
  "Website",
  "Domain",
  "Hosting",
  "Other",
];

export const SEED_TICKETS: SupportTicket[] = [
  {
    id: "TKT-2001",
    subject: "Não consigo configurar o email no meu telemóvel",
    category: "Technical Support",
    priority: "High",
    status: "In Progress",
    createdAt: "2026-09-02T09:30:00.000Z",
    updatedAt: "2026-09-05T14:20:00.000Z",
    messages: [
      {
        id: "m1",
        author: "Cliente",
        text: "Boa tarde, não consigo configurar a caixa de email no Outlook do telemóvel. Recebo sempre erro de autenticação.",
        date: "2026-09-02T09:30:00.000Z",
      },
      {
        id: "m2",
        author: "Suporte",
        text: "Olá! Pode partilhar as suas credenciais IMAP/SMTP por mensagem privada? Vamos verificar a configuração.",
        date: "2026-09-02T15:10:00.000Z",
      },
      {
        id: "m3",
        author: "Cliente",
        text: "Aqui estão: server mail.seu-dominio.com, porta 993, SSL ativo.",
        date: "2026-09-03T08:05:00.000Z",
      },
    ],
  },
  {
    id: "TKT-1998",
    subject: "Pedido de factura proforma",
    category: "Billing",
    priority: "Normal",
    status: "Waiting for Customer",
    createdAt: "2026-08-28T11:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    messages: [
      {
        id: "m1",
        author: "Cliente",
        text: "Preciso de uma factura proforma para o novo website empresarial.",
        date: "2026-08-28T11:00:00.000Z",
      },
      {
        id: "m2",
        author: "Suporte",
        text: "Enviámos a factura INV-1024 para o seu email. Confirma a recepção?",
        date: "2026-08-29T09:15:00.000Z",
      },
    ],
  },
  {
    id: "TKT-1993",
    subject: "Renovação automática de domínio",
    category: "Domain",
    priority: "Normal",
    status: "Resolved",
    createdAt: "2026-08-20T13:40:00.000Z",
    updatedAt: "2026-08-21T16:00:00.000Z",
    messages: [
      {
        id: "m1",
        author: "Cliente",
        text: "Quero confirmar que a renovação automática do meu domínio está ativa.",
        date: "2026-08-20T13:40:00.000Z",
      },
      {
        id: "m2",
        author: "Suporte",
        text: "Confirmado! A renovação automática está ativa para o seu domínio .co.mz.",
        date: "2026-08-21T09:00:00.000Z",
      },
      {
        id: "m3",
        author: "Cliente",
        text: "Perfeito, obrigado!",
        date: "2026-08-21T16:00:00.000Z",
      },
    ],
  },
];

// ─── Persistência local ───────────────────────────────────────────────
const KEY = "idesign-tickets-v1";

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTickets(): SupportTicket[] {
  if (typeof window === "undefined") {
    return SEED_TICKETS;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      return JSON.parse(raw) as SupportTicket[];
    }
  } catch {
    // ignore
  }
  return SEED_TICKETS;
}

function persist(tickets: SupportTicket[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tickets));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

export function createTicket(input: {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  text: string;
  attachment?: { name: string; size: string };
}): SupportTicket {
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: `TKT-${Math.floor(2000 + Math.random() * 90)}`,
    subject: input.subject,
    category: input.category,
    priority: input.priority,
    status: "Open",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: `m-${Date.now().toString(36)}`,
        author: "Cliente",
        text: input.text,
        date: now,
        attachment: input.attachment,
      },
    ],
  };
  persist([ticket, ...getTickets()]);
  return ticket;
}

export function replyToTicket(
  ticketId: string,
  text: string,
  attachment?: { name: string; size: string },
) {
  const tickets = getTickets();
  const now = new Date().toISOString();
  const updated = tickets.map((t) => {
    if (t.id !== ticketId) {
      return t;
    }
    return {
      ...t,
      status: "Waiting for Customer" as const,
      updatedAt: now,
      messages: [
        ...t.messages,
        {
          id: `m-${Date.now().toString(36)}`,
          author: "Cliente",
          text,
          date: now,
          attachment,
        },
      ],
    };
  });
  persist(updated);
}

export function setTicketStatus(ticketId: string, status: TicketStatus) {
  const tickets = getTickets();
  const now = new Date().toISOString();
  persist(
    tickets.map((t) => (t.id === ticketId ? { ...t, status, updatedAt: now } : t)),
  );
}