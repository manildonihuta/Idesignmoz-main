"use client";

import type { ClientOrder } from "@/lib/client-data";

function fmt(price: number | null): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("pt-MZ").format(price) + " MT";
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  registered: "Registado",
  cancelled: "Cancelado",
};

export function OrdersView({ orders }: { orders: ClientOrder[] }) {
  if (!orders.length) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
        Ainda não tem encomendas. Complete uma compra para ver o estado aqui.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {orders.map((order) => (
        <article className="order-card" key={order.id}>
          <div className="order-head">
            <div>
              <span className="order-label">Order</span>
              <h3>{order.id}</h3>
            </div>
            <span className="order-status">{STATUS_LABEL[order.status] ?? order.status}</span>
          </div>
          <div className="order-block">
            <span className="order-label">Product</span>
            <ul className="order-products">
              <li key={order.fullDomain}>
                <b className="order-kind">Domínio</b>
                <span className="order-domain">{order.fullDomain}</span>
                <em>{fmt(order.price)}</em>
              </li>
            </ul>
            <p className="order-total-text">Total · <b>{fmt(order.price)}</b></p>
          </div>
        </article>
      ))}
    </div>
  );
}
