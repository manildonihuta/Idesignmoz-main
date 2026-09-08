import type { CartItem } from "@/lib/cart";

export type OrderStatus = "Paid";

export type NextStepStatus = "done" | "pending";

export type NextStep = {
  label: string;
  status: NextStepStatus;
};

export type Order = {
  id: string;
  date: string;
  status: OrderStatus;
  total: number;
  customer?: {
    fullName?: string;
    email?: string;
  };
  items: CartItem[];
};

export type ProductKind = "Domain" | "Hosting" | "Website" | "Service";

const NEXT_STEPS: NextStep[] = [
  { label: "Payment confirmed", status: "done" },
  { label: "Domain processing", status: "done" },
  { label: "Hosting provisioning", status: "done" },
  { label: "Website onboarding", status: "pending" },
];

const KIND_LABEL: Record<ProductKind, string> = {
  Domain: "Domain",
  Hosting: "Hosting",
  Website: "Website",
  Service: "Service",
};

export function getNextSteps(): NextStep[] {
  return NEXT_STEPS;
}

/**
 * Converte um item do carrinho para o tipo de produto exibido na encomenda.
 */
export function getProductKind(item: CartItem): ProductKind {
  if (item.kind === "hosting" || item.kind === "email") {
    return "Hosting";
  }
  if (item.kind === "renewal" || item.kind === "registration") {
    return "Domain";
  }
  if (item.kind === "website" || item.kind === "branding" || item.kind === "software" || item.kind === "design") {
    return "Website";
  }
  return "Service";
}

export function getProductKindLabel(kind: ProductKind): string {
  return KIND_LABEL[kind];
}

export function buildOrder(items: CartItem[], total: number, customer?: Order["customer"]): Order {
  return {
    id: generateOrderId(),
    date: new Date().toISOString(),
    status: "Paid",
    total,
    customer,
    items,
  };
}

function generateOrderId(): string {
  const hash = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IDM-${hash}`;
}

const ORDERS_KEY = "idesign-orders";

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSavedOrders(): Order[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: Order): Order[] {
  const orders = [order, ...getSavedOrders()];
  try {
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
  return orders;
}
