"use client";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AdminSubscription, Notify } from "./types";
import type { useAdminData } from "./use-admin-data";
import { card, Empty, Pill, SectionHead, fmtMT, fmtDate } from "./views";

type Actions = ReturnType<typeof useAdminData>["actions"];

const STATUS_META: Record<string, { label: string; tone: "brand" | "warn" | "ok" | "muted" | "danger" }> = {
  active: { label: "Activa", tone: "ok" },
  past_due: { label: "Em atraso", tone: "warn" },
  suspended: { label: "Suspensa", tone: "danger" },
  terminated: { label: "Terminada", tone: "muted" },
  paused: { label: "Pausada", tone: "muted" },
  cancelled: { label: "Cancelada", tone: "muted" },
  expired: { label: "Expirada", tone: "muted" },
};

const KIND_LABEL: Record<string, string> = {
  hosting: "Alojamento",
  service: "Serviço",
  package: "Pacote",
};

const CYCLE_LABEL: Record<string, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semiannual: "Semestral",
  year: "Anual",
};

type Filter = "all" | "active" | "past_due" | "suspended" | "terminated";

export function SubscriptionsAdminView({
  subscriptions,
  isBusy,
  actions,
  notify,
}: {
  subscriptions: AdminSubscription[];
  isBusy: (id: string) => boolean;
  actions: Actions;
  notify: Notify;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: subscriptions.length, active: 0, past_due: 0, suspended: 0, terminated: 0 };
    for (const s of subscriptions) {
      if (STATUS_META[s.status]) c[s.status as Filter] += 1;
    }
    return c;
  }, [subscriptions]);

  const rows = useMemo(
    () => (filter === "all" ? subscriptions : subscriptions.filter((s) => s.status === filter)),
    [subscriptions, filter],
  );

  async function runCheck() {
    const r = await actions.runBillingCheck();
    notify(r.ok ? "ok" : "error", r.ok ? r.note ?? "Ciclo de cobrança verificado." : (r as { error: string }).error);
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: `Todas · ${counts.all}` },
    { id: "active", label: `Activas · ${counts.active}` },
    { id: "past_due", label: `Em atraso · ${counts.past_due}` },
    { id: "suspended", label: `Suspensas · ${counts.suspended}` },
    { id: "terminated", label: `Terminadas · ${counts.terminated}` },
  ];

  const stale = subscriptions.filter((s) => s.status === "past_due" || s.status === "suspended").length;

  return (
    <div className="space-y-5">
      <SectionHead
        title={`Subscrições · ${subscriptions.length}`}
        desc={
          stale
            ? `${stale} subscrição(ões) com cobrança em atraso ou suspensa há mais de ${suspendedHint(subscriptions)}.`
            : "Ciclos de faturação e estado de todas as subscrições."
        }
        right={
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={isBusy("__billing")}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            title="Avança o ciclo de faturação (vencidas → atraso → suspensão → término)"
          >
            <RefreshCw className={`h-4 w-4 ${isBusy("__billing") ? "animate-spin" : ""}`} /> Verificar ciclo
          </button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              filter === f.id
                ? "border-brand bg-brand/10 text-brand"
                : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-paper"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={card}>
        {rows.length === 0 ? (
          <Empty text="Sem subscrições para mostrar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Cliente</th>
                  <th className="px-2 py-2 font-medium">Tipo</th>
                  <th className="px-2 py-2 font-medium">Plano</th>
                  <th className="px-2 py-2 font-medium">Ciclo</th>
                  <th className="px-2 py-2 font-medium text-right">Valor</th>
                  <th className="px-2 py-2 font-medium">Renova</th>
                  <th className="px-2 py-2 font-medium">Cobrança</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const meta = STATUS_META[s.status] ?? { label: s.status, tone: "muted" as const };
                  const billingSince = s.status === "past_due"
                    ? (s.past_due_since ?? s.renews_at ?? s.created_at)
                    : s.status === "suspended"
                      ? (s.suspended_since ?? s.past_due_since ?? s.renews_at ?? s.created_at)
                      : null;
                  return (
                    <tr key={s.id} className="border-b border-line align-top last:border-0 hover:bg-ink/40">
                      <td className="px-2 py-3">
                        <p className="font-medium text-paper">{s.customer_email ?? "—"}</p>
                        <p className="text-[11px] text-muted">{s.customer_name ?? s.customer_id ?? "Sem cliente"}</p>
                      </td>
                      <td className="px-2 py-3">
                        <Pill tone="muted">{KIND_LABEL[s.kind] ?? s.kind}</Pill>
                      </td>
                      <td className="px-2 py-3">{s.plan_name ?? "—"}</td>
                      <td className="px-2 py-3">{CYCLE_LABEL[s.period] ?? s.period}</td>
                      <td className="px-2 py-3 text-right font-medium text-paper">{fmtMT(s.price)}</td>
                      <td className="px-2 py-3">{s.renews_at ? fmtDate(s.renews_at) : "—"}</td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {billingSince ? fmtDate(billingSince) : "—"}
                        {!s.auto_renew && <p className="text-[10px]">renovação desligada</p>}
                      </td>
                      <td className="px-2 py-3">
                        <Pill tone={meta.tone}>{meta.label}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function suspendedHint(subscriptions: AdminSubscription[]): string {
  const g = subscriptions.find((s) => s.status === "suspended");
  if (g?.suspended_since) return new Date(g.suspended_since).toLocaleDateString("pt-PT");
  return "data indicada na linha";
}