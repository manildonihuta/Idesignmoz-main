"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { clearCart, getServerSnapshot, getSnapshot, kindLabel, removeFromCart, subscribe } from "@/lib/cart";
import { CATEGORY_ICON } from "@/lib/catalog-types";

function fmt(price: number): string {
  return new Intl.NumberFormat("pt-MZ").format(price);
}

function periodLabel(period: string): string {
  if (period === "monthly") return "por mês";
  if (period === "annual") return "por ano";
  return "pagamento único";
}

export function CartView() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-muted">O seu carrinho está vazio.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link className="button" href="/domains">
            Procurar domínio ↗
          </Link>
          <Link className="outline-button" href="/hosting">
            Ver alojamento ↗
          </Link>
        </div>
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="rounded-xl border border-line bg-surface">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={`${item.kind}-${item.fullDomain}-${item.productId ?? ""}`} className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {item.category ? `${CATEGORY_ICON[item.category]} ` : ""}{item.fullDomain || item.label}
              </p>
              <p className="text-sm text-muted">
                {item.fullDomain ? item.label : kindLabel(item.category ?? item.kind)}
                {" · "}
                {periodLabel(item.period)}
              </p>
            </div>
            <b className="whitespace-nowrap">{fmt(item.price)} MT</b>
            <button
              className="text-sm text-lime hover:opacity-80"
              type="button"
              onClick={() => removeFromCart(item)}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line p-5">
        <div>
          <span className="text-sm text-muted">Total</span>
          <b className="ml-2 text-lg">{fmt(total)} MT</b>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="outline-button"
            type="button"
            onClick={clearCart}
          >
            Limpar
          </button>
          <Link className="button" href="/checkout">
            Finalizar compra ↗
          </Link>
        </div>
      </div>
    </div>
  );
}