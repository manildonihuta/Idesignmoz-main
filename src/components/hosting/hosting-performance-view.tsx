"use client";

import { Activity } from "lucide-react";

import { EmptyState } from "@/components/ui/core";
import { hostingApi } from "@/lib/hosting/client-api";
import type { HostingPerformanceReport } from "@/services/hosting-panel.service";
import { useSectionData, useHostingPanel, CapabilityGate } from "@/components/hosting/hosting-shared";

export default function HostingPerformanceView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const { data, error, loading } = useSectionData<HostingPerformanceReport>(`perf-${hostingId}`, () =>
    hostingApi.performance(hostingId).then((r) => r.report),
  );

  return (
    <CapabilityGate capabilities={capabilities} required="performance" feature="Desempenho">
      <div className="space-y-6">
        <div>
          <h2 className="font-display-2 text-lg font-semibold tracking-tight">Desempenho</h2>
          <p className="mt-1 text-sm text-muted">Perspetiva de saúde do alojamento — métricas atuais e recomendações.</p>
        </div>

        {loading ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">A carregar…</p>
        ) : error ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-brand">{error}</p>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-6">
              <div className="flex size-16 items-center justify-center rounded-full border-2 border-ok/40 text-ok">
                <span className="font-display-2 text-2xl font-semibold">{data.score}</span>
              </div>
              <div>
                <p className="font-medium text-paper">{data.score >= 80 ? "Desempenho saudável" : data.score >= 50 ? "Desempenho razoável" : "Desempenho fraco"}</p>
                <p className="text-sm text-muted">Índice de desempenho (0–100).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.metrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
                  <span className="text-sm text-muted">{metric.label}</span>
                  <span
                    className={`text-sm font-semibold ${
                      metric.tone === "danger" ? "text-brand" : metric.tone === "warn" ? "text-paper" : "text-ok"
                    }`}
                  >
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="mb-2 font-medium">Recomendações</h3>
              <ul className="space-y-2 text-sm text-muted">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-brand">›</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Activity}
            title="Sem métricas disponíveis."
            className="rounded-2xl border border-line bg-surface p-10"
          />
        )}
      </div>
    </CapabilityGate>
  );
}