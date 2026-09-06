export type MessageStatus = "new" | "in_progress" | "done";
export type OrderStatus = "pending" | "paid" | "registered" | "cancelled";
export type DomainStatus = "available" | "registered" | "reserved";
export type UserRole = "client" | "admin";

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

export type AdminData = {
  messages: AdminMessage[];
  orders: AdminOrder[];
  domains: AdminDomain[];
  profiles: AdminProfile[];
  emailByUserId: Record<string, string>;
};

export type Notice = { type: "ok" | "error"; text: string };
export type Notify = (type: "ok" | "error", text: string) => void;