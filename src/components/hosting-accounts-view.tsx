"use client";

import type { ClientHostingAccount } from "@/lib/client-data";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  active: "Activo",
  suspended: "Suspenso",
  terminated: "Terminado",
  cancelled: "Cancelado",
};

export function HostingAccountsView({ accounts }: { accounts: ClientHostingAccount[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Alojamento
        </h1>
        <p className="text-muted">Os planos de alojamento associados à sua conta.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {accounts.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não tem planos de alojamento associados.
          </div>
        )}
        {accounts.map((account) => (
          <article className="hosting-card" key={account.id}>
            <div className="website-card-head">
              <div>
                <h3>{account.domain ?? "Conta de alojamento"}</h3>
                <p className="website-url">
                  {account.username ?? account.id.slice(0, 8)} · {account.quotaGb} GB
                </p>
              </div>
              <span
                className={`site-status ${
                  account.status === "active" ? "live" : account.status === "pending" ? "dev" : "off"
                }`}
              >
                {STATUS_LABEL[account.status] ?? account.status}
              </span>
            </div>
            <div className="website-meta">
              <div>
                <span className="order-label">Domínio</span>
                <p>{account.domain ?? "—"}</p>
              </div>
              <div>
                <span className="order-label">Renova</span>
                <p>{account.renewsAt ? new Date(account.renewsAt).toLocaleDateString("pt-MZ") : "—"}</p>
              </div>
              <div>
                <span className="order-label">Criada</span>
                <p>{new Date(account.createdAt).toLocaleDateString("pt-MZ")}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
