import { useSyncExternalStore } from "react";

import {
  UPSEL_CHAIN,
  type CatalogProduct,
  type CrossSellOffer,
  type ProductCategory,
} from "@/lib/catalog-types";
import type { CatalogProductRow, CrossSellRule } from "@/lib/content";

export type CatalogPayload = {
  products: CatalogProductRow[];
  rules: CrossSellRule[];
  pricingToCatalog: Record<string, string>;
  annualDiscount: number;
};

let data: CatalogPayload | null = null;
let error: Error | null = null;
let loading = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notReady(): boolean {
  return !loading && data === null && error === null;
}

function ensureLoaded(): void {
  if (typeof window === "undefined" || !notReady()) return;
  loading = true;
  fetch("/api/catalog", { headers: { Accept: "application/json" } })
    .then(async (res) => {
      if (!res.ok) throw new Error(`catalog ${res.status}`);
      return (await res.json()) as CatalogPayload;
    })
    .then((payload) => {
      data = payload;
    })
    .catch((cause: unknown) => {
      error = cause instanceof Error ? cause : new Error("failed to load catalog");
    })
    .finally(() => {
      loading = false;
      emit();
    });
}

function getSnapshot(): CatalogPayload | null {
  return data;
}

/** Client-side catalog loader (DB-backed); returns null until loaded. */
export function useCatalog(): {
  data: CatalogPayload | null;
  error: Error | null;
  loading: boolean;
} {
  if (notReady()) {
    ensureLoaded();
  }
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { data: snap, error, loading };
}

export function findCatalogProduct(id: string, products: CatalogProduct[]): CatalogProduct | undefined {
  return products.find((product) => product.id === id);
}

/** Default product for an upsell category, resolved from cross-sell rules. */
export function defaultProductForCategory(
  cat: ProductCategory,
  products: CatalogProduct[],
): CatalogProduct | undefined {
  for (const rule of data?.rules ?? []) {
    if (rule.category !== cat) continue;
    if (!rule.productId) continue;
    const product = findCatalogProduct(rule.productId, products);
    if (product) return product;
  }
  return products.find((product) => product.category === cat);
}

/** Categories to suggest next (upsell chain not yet in the cart). */
export function suggestUpsells(cartCategories: ProductCategory[]): ProductCategory[] {
  const inCart = new Set(cartCategories);
  const suggested: ProductCategory[] = [];
  for (const cat of UPSEL_CHAIN) {
    const nextIndex = UPSEL_CHAIN.indexOf(cat) + 1;
    const next = UPSEL_CHAIN[nextIndex];
    if (next && inCart.has(cat) && !inCart.has(next)) {
      suggested.push(next);
    }
  }
  return suggested;
}

/** Cross-sell offers from DB rules for the categories the customer owns. */
export function crossSellOffers(
  purchased: ProductCategory[],
  products: CatalogProduct[],
  limit = 3,
): CrossSellOffer[] {
  const owned = new Set(purchased);
  const rules = [...(data?.rules ?? [])].sort((a, b) => a.sort - b.sort);
  const offers: CrossSellOffer[] = [];
  for (const rule of rules) {
    if (offers.length >= limit) break;
    if (!owned.has(rule.trigger)) continue;
    if (owned.has(rule.category)) continue;
    const product =
      (rule.productId ? findCatalogProduct(rule.productId, products) : undefined) ??
      defaultProductForCategory(rule.category, products);
    if (!product) continue;
    offers.push({
      category: rule.category,
      productId: product.id,
      eyebrow: rule.eyebrow,
      headline: rule.headline,
      body: rule.body,
      href: product.href,
    });
  }
  return offers;
}