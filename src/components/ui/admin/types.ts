export type MessageStatus = "new" | "in_progress" | "done";
export type OrderStatus = "pending" | "paid" | "registered" | "cancelled";
export type DomainStatus = "available" | "registered" | "reserved";
export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "sales"
  | "developer"
  | "designer"
  | "support"
  | "customer"
  | "client";

export type AdminMessage = {
  id: string;
  name: string;
  email: string;
  service: string;
  message: string;
  status: MessageStatus;
  created_at: string;
};

export type AdminOrder = {
  id: string;
  full_domain: string;
  extension: string;
  name: string;
  email: string;
  price: number | null;
  status: OrderStatus;
  created_at: string;
};

export type AdminDomain = {
  id: string;
  full_domain: string;
  status: DomainStatus;
  price: number | null;
  checked_at: string;
};

export type AdminProfile = {
  id: string;
  full_name: string | null;
  company: string | null;
  role: UserRole;
  created_at: string;
};

export type AdminSubscription = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  kind: string;
  plan_id: string | null;
  plan_name: string | null;
  period: string;
  price: number;
  currency: string;
  status: string;
  starts_at: string | null;
  renews_at: string | null;
  auto_renew: boolean;
  payment_method: string | null;
  past_due_since: string | null;
  suspended_since: string | null;
  created_at: string;
};

export type AdminData = {
  messages: AdminMessage[];
  orders: AdminOrder[];
  domains: AdminDomain[];
  profiles: AdminProfile[];
  emailByUserId: Record<string, string>;
  subscriptions: AdminSubscription[];
};

export type Notice = { type: "ok" | "error"; text: string };
export type Notify = (type: "ok" | "error", text: string) => void;