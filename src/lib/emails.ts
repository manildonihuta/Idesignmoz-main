export type MailboxStatus = "Active" | "Pending" | "Suspended";

export type Mailbox = {
  mailbox: string;
  displayName: string;
  storageTotal: string;
  storageUsed: string;
  status: MailboxStatus;
  expiry: string;
  quotaPercent: number;
};

export const MAILBOXES: Mailbox[] = [
  {
    mailbox: "sales@company.co.mz",
    displayName: "Vendas",
    storageTotal: "10 GB",
    storageUsed: "2.4 GB",
    status: "Active",
    expiry: "30 Jan 2027",
    quotaPercent: 24,
  },
  {
    mailbox: "info@company.co.mz",
    displayName: "Informações",
    storageTotal: "10 GB",
    storageUsed: "1.1 GB",
    status: "Active",
    expiry: "30 Jan 2027",
    quotaPercent: 11,
  },
  {
    mailbox: "support@company.co.mz",
    displayName: "Suporte",
    storageTotal: "10 GB",
    storageUsed: "3.8 GB",
    status: "Active",
    expiry: "15 Fev 2027",
    quotaPercent: 38,
  },
];

export type EmailPlan = {
  name: string;
  price: string;
  period: string;
  storage: string;
  features: string[];
};

export const EMAIL_PLAN: EmailPlan = {
  name: "Professional Email",
  price: "499",
  period: "mês",
  storage: "10 GB por caixa",
  features: [
    "Webmail + IMAP/SMTP",
    "Anti-spam e antivírus",
    "SSL/TLS",
    "Suporte prioritário",
  ],
};

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-MZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}