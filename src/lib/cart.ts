import { CATEGORY_LABEL_PT, type CatalogProduct, type ProductCategory, type SellPeriod } from "@/lib/catalog-types";
import type { CurrencyCode } from "@/lib/currency";

export type CartKind =
  | "domain"
  | "registration"
  | "renewal"
  | "hosting"
  | "email"
  | "website"
  | "branding"
  | "software"
  | "design"
  | "seo"
  | "marketing"
  | "maintenance";

export type CartItem = {
  fullDomain: string;
  extension: string;
  /** Integer minor units of `currency` (never float). */
  price: number;
  currency: CurrencyCode;
  kind: CartKind;
  label: string;
  period: SellPeriod;
  /** Catalog id for non-domain products (e.g. "hosting-shared-business"). */
  productId?: string;
  category?: ProductCategory;
};

const KEY = "idesign-cart";

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: CartItem[] | null = null;

function read(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: CartItem[]) {
  cached = items;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): CartItem[] {
  if (cached === null) {
    cached = read();
  }
  return cached;
}

export function getServerSnapshot(): CartItem[] {
  return [];
}

export function getCart(): CartItem[] {
  return getSnapshot();
}

function sameItem(a: CartItem, b: CartItem): boolean {
  if (a.productId && b.productId) {
    return a.kind === b.kind && a.productId === b.productId;
  }
  return a.kind === b.kind && a.fullDomain === b.fullDomain;
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getSnapshot().filter((existing) => !sameItem(existing, item));
  cart.push(item);
  persist(cart);
  return cart;
}

export function removeFromCart(item: CartItem): CartItem[] {
  const cart = getSnapshot().filter((existing) => !sameItem(existing, item));
  persist(cart);
  return cart;
}

export function clearCart(): void {
  persist([]);
}

export function cartTotal(): number {
  return getSnapshot().reduce((sum, item) => sum + item.price, 0);
}

/** Price of a catalog product given the chosen billing period.
 * Prices come from the DB catalog; quarterly/semiannual use the product's
 * configured price when present, otherwise they fall back to the monthly
 * price scaled to the cycle (the monthly price is authoritative in the DB). */
export function catalogPrice(product: CatalogProduct, period: SellPeriod): number {
  const meta = (product.meta ?? {}) as { price_quarterly?: number; price_semiannual?: number };
  if (period === "annual" && product.annualPrice != null) {
    return product.annualPrice;
  }
  if (period === "quarterly") {
    return meta.price_quarterly ?? product.price * 3;
  }
  if (period === "semiannual") {
    return meta.price_semiannual ?? product.price * 6;
  }
  return product.price;
}

/** Build a CartItem from a catalog product and add it (dedupes by product id).
 * `opts.fullDomain` attaches an account domain (hosting/email) to the item. */
export function addCatalogToCart(
  product: CatalogProduct,
  period: SellPeriod,
  opts?: { fullDomain?: string },
): CartItem[] {
  const fullDomain = (opts?.fullDomain ?? "").trim().toLowerCase();
  const dot = fullDomain.lastIndexOf(".");
  const item: CartItem = {
    fullDomain,
    extension: dot > 0 ? fullDomain.slice(dot) : "",
    price: catalogPrice(product, period),
    currency: product.currency ?? "MZN",
    kind: product.category,
    label: product.name,
    period,
    productId: product.id,
    category: product.category,
  };
  return addToCart(item);
}

/** Distinct product categories currently in the cart. */
export function cartCategories(): ProductCategory[] {
  const seen = new Map<string, true>();
  for (const item of getSnapshot()) {
    const cat = item.category ?? item.label;
    if (cat && !seen.has(cat)) {
      seen.set(cat, true);
    }
  }
  return Array.from(seen.keys()) as ProductCategory[];
}

export function kindLabel(kind: CartKind): string {
  return CATEGORY_LABEL_PT[kind as ProductCategory] ?? kind;
}