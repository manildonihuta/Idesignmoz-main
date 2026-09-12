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