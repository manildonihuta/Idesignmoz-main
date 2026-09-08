"use client";

import { CYCLE_LABELS, type BillingCycle, type ClientSubscription } from "@/lib/billing";

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  past_due: "Em atraso",
  suspended: "Suspensa",
  terminated: "Terminada",
  paused: "Pausada",
  cancelled: "Cancelada",
  expired: "Expirada",
};

function fmt(price: number): string {
  return new Intl.NumberFormat("pt-MZ").format(price);
}

export function SubscriptionsView({ subscriptions }: { subscriptions: ClientSubscription[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">Subscrições</h1>
        <p className="text-muted">Ciclos de facturação e estado das suas subscrições.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {subscriptions.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não tem subscrições activas.
          </div>
        )}
        {subscriptions.map((sub) => (
          <article className="hosting-card" key={sub.id}>
            <div className="website-card-head">
              <div>
                <h3>{sub.kind === "hosting" ? "Alojamento" : sub.kind === "service" ? "Serviço" : "Pacote"}</h3>
                <p className="website-url">
                  {fmt(sub.price)} MT · {CYCLE_LABELS[sub.period as BillingCycle] ?? sub.period}
                </p>
              </div>
              <span
                className={`site-status ${
                  sub.status === "active" ? "live" : sub.status === "past_due" ? "dev" : "off"
                }`}
              >
                {STATUS_LABEL[sub.status] ?? sub.status}
              </span>
            </div>
            <div className="website-meta">
              <div>
                <span className="order-label">Renova</span>
                <p>{sub.renewsAt ? new Date(sub.renewsAt).toLocaleDateString("pt-MZ") : "—"}</p>
              </div>
              <div>
                <span className="order-label">Renovação automática</span>
                <p>{sub.autoRenew ? "Ligada" : "Desligada"}</p>
              </div>
              <div>
                <span className="order-label">Método</span>
                <p>{sub.paymentMethod ?? "—"}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}