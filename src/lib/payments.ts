export type PaymentMethod = {
  id: string;
  label: string;
  detail: string;
  status: "Active" | "Expired";
  primary: boolean;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  method: string;
  reference: string;
  status: "Paid" | "Pending" | "Failed";
  amount: number;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "mpesa",
    label: "M-Pesa",
    detail: "+258 84 000 0000",
    status: "Active",
    primary: true,
  },
  {
    id: "emola",
    label: "e-Mola",
    detail: "+258 84 000 0000",
    status: "Active",
    primary: false,
  },
  {
    id: "visa",
    label: "Visa •••• 4242",
    detail: "Expira 08/28",
    status: "Active",
    primary: false,
  },
];

export const TRANSACTIONS: Transaction[] = [
  {
    id: "PAY-2048",
    date: "01 Set 2026",
    description: "Business Website",
    method: "M-Pesa",
    reference: "IDM-1092",
    status: "Paid",
    amount: 55000,
  },
  {
    id: "PAY-2047",
    date: "28 Ago 2026",
    description: "Domain .com + Hosting",
    method: "Visa",
    reference: "IDM-1091",
    status: "Paid",
    amount: 10900,
  },
  {
    id: "PAY-2046",
    date: "15 Ago 2026",
    description: "Hosting Business (1 ano)",
    method: "e-Mola",
    reference: "IDM-1087",
    status: "Paid",
    amount: 4990,
  },
  {
    id: "PAY-2045",
    date: "20 Jul 2026",
    description: "E-commerce project",
    method: "Bank Transfer",
    reference: "IDM-1080",
    status: "Paid",
    amount: 85000,
  },
];

export function fmtMT(value: number): string {
  return new Intl.NumberFormat("pt-MZ", { maximumFractionDigits: 0 }).format(value);
}