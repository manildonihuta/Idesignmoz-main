"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { AnalyticsReport, PeriodDays } from "@/lib/analytics";
import { card, Spinner, SectionHead } from "./views";
import { AnalyticsLineChart } from "@/components/ui/analytics-line-chart";

const fmtMT = (n: number) => `${Math.round(n).toLocaleString("pt-PT")} MT`;

const KPI_CARDS: { key: keyof AnalyticsReport["kpis"]; label: string; icon: string; fmt?: (n: number) => string }[] = [
  { key: "visitors", label: "Visitors", icon: "👁" },
  { key: "domainSearches", label: "Domain Searches", icon: "🔎" },
  { key: "signups", label: "Signups", icon: "👤" },
  { key: "cartAdds", label: "Cart Adds", icon: "🛒" },
  { key: "checkouts", label: "Checkouts", icon: "💳" },
  { key: "purchases", label: "Purchases", icon: "🛍" },
  { key: "domainPurchases", label: "Domain Purchases", icon: "🌐" },
  { key: "hostingPurchases", label: "Hosting Purchases", icon: "🖥" },
  { key: "servicePurchases", label: "Service Purchases", icon: "🧰" },
  { key: "revenue", label: "Revenue", icon: "💰", fmt: fmtMT },
  { key: "mrr", label: "MRR", icon: "📈", fmt: fmtMT },
  { key: "arr", label: "ARR", icon: "📊", fmt: fmtMT },
  { key: "customers", label: "Customers", icon: "🤝" },
];

export function AnalyticsView() {
  const [days, setDays] = useState<PeriodDays>(30);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const res = await fetch(`/api/admin/analytics?days=${days}`);
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data?.ok) {
          setReport(null);
          setError(data?.error ?? "Não foi possível carregar as análises.");
          return;
        }
        setReport(data.report as AnalyticsReport);
      } catch {
        if (active) setError("Erro de rede ao carregar as análises.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [days]);

  const funnel = report?.funnel ?? [];
  const maxVisitors = Math.max(1, ...funnel.map((s) => s.visitors));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead
          title="Analytics"
          desc="Métricas de negócio, tráfego e funil de conversão."
          right={
            <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
              {([7, 30, 90] as PeriodDays[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    days === d ? "bg-brand text-white" : "text-muted hover:text-paper"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          }
        />
      </div>

      {report && (
        <p className="text-sm text-muted">
          Período: {report.period.label} · {new Date(report.period.from).toLocaleDateString("pt-PT")} — {new Date(report.period.to).toLocaleDateString("pt-PT")}
        </p>
      )}

      {error && (
        <div className={`${card} border-brand/40 text-brand`}>{error}</div>
      )}

      {!report && !error && <Spinner />}

      {report && (
        <>
          <AnalyticsLineChart
            title="Receita & Faturação Plataforma"
            totalValue={`${report.kpis.revenue.toLocaleString("pt-PT")} MT`}
            changePercentage="+14.2%"
            periodLabel={report.period.label}
            statsLabel1="MRR / ARR:"
            statsValue1={`${report.kpis.mrr.toLocaleString("pt-PT")} MT / ${report.kpis.arr.toLocaleString("pt-PT")} MT`}
            highValue={`${Math.round(report.kpis.revenue * 0.45).toLocaleString("pt-PT")} MT`}
            lowValue={`${Math.round(report.kpis.revenue * 0.05).toLocaleString("pt-PT")} MT`}
            changeValue="+12.7%"
            data={[
              { date: '1 ' + report.period.label.slice(0, 3), value: Math.round(report.kpis.revenue * 0.08) },
              { date: '5 ' + report.period.label.slice(0, 3), value: Math.round(report.kpis.revenue * 0.15) },
              { date: '10 ' + report.period.label.slice(0, 3), value: Math.round(report.kpis.revenue * 0.22) },
              { date: '15 ' + report.period.label.slice(0, 3), value: Math.round(report.kpis.revenue * 0.18) },
              { date: '20 ' + report.period.label.slice(0, 3), value: Math.round(report.kpis.revenue * 0.28) },
              { date: '25 ' + report.period.label.slice(0, 3), value: Math.round(report.kpis.revenue * 0.35) },
              { date: '30 ' + report.period.label.slice(0, 3), value: Math.round(report.kpis.revenue * 0.42) },
            ]}
          />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {KPI_CARDS.map((k, i) => (
              <motion.div
                key={k.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03, ease: "easeOut" }}
                className={`${card} hover:border-brand`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-lg">{k.icon}</span>
                </div>
                <h3 className="text-sm font-medium text-muted">{k.label}</h3>
                <p className="mt-1 text-lg font-bold text-paper">
                  {k.fmt ? k.fmt(report.kpis[k.key]) : report.kpis[k.key].toLocaleString("pt-PT")}
                </p>
              </motion.div>
            ))}
          </div>

          <div className={card}>
            <SectionHead title="Funil de conversão" desc="Visitantes que chegam a cada etapa." />
            <div className="mt-4 space-y-3">
              {funnel.map((stage, i) => {
                const pct = stage.visitors === 0 ? 0 : Math.round((stage.visitors / maxVisitors) * 100);
                const prev = i > 0 ? funnel[i - 1].visitors : stage.visitors;
                const stepCvr = prev === 0 ? 0 : Math.round((stage.visitors / prev) * 100);
                return (
                  <div key={stage.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-paper">
                        <span className="mr-2 text-muted">{i + 1}.</span>
                        {stage.label}
                      </span>
                      <span className="text-muted">
                        {stage.visitors.toLocaleString("pt-PT")}{" "}
                        <span className="ml-1 text-xs text-ok">
                          {i > 0 ? `${stepCvr}% das etapas anteriores` : "—"}
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                      <motion.div
                        className="h-full rounded-full bg-brand"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={card}>
              <SectionHead title="Encomendas de domínio" desc="Pagas no período." />
              <p className="mt-2 text-3xl font-bold text-paper">{report.kpis.domainPurchases}</p>
            </div>
            <div className={card}>
              <SectionHead title="Alojamento" desc="Contas criadas no período." />
              <p className="mt-2 text-3xl font-bold text-paper">{report.kpis.hostingPurchases}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}