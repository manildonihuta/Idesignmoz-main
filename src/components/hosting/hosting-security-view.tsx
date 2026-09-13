"use client";

import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

import { EmptyState, LoadingIndicator } from "@/components/ui/core";
import type { HostingSecurityReport } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, useHostingPanel, CapabilityGate } from "@/components/hosting/hosting-shared";

export default function HostingSecurityView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const { data, error, loading } = useSectionData<HostingSecurityReport>(`sec-${hostingId}`, () =>
    hostingApi.security(hostingId).then((r) => r.report),
  );

  return (
    <CapabilityGate capabilities={capabilities} required="security" feature="Segurança">
      <div className="space-y-6">
        <div>
          <h2 className="font-display-2 text-lg font-semibold tracking-tight">Segurança</h2>
          <p className="mt-1 text-sm text-muted">Avaliação honesta da postura de segurança da conta, calculada a partir do estado real.</p>
        </div>

        {loading ? (
          <LoadingIndicator label="A analisar segurança…" />
        ) : error ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-brand">{error}</p>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-6">
              <div className="flex size-16 items-center justify-center rounded-full border-2 border-ok/40 text-ok">
                <span className="font-display-2 text-2xl font-semibold">{data.score}</span>
              </div>
              <div>
                <p className="font-medium text-paper">{data.score >= 80 ? "Postura boa" : data.score >= 50 ? "Postura razoável" : "Precisa de atenção"}</p>
                <p className="text-sm text-muted">Índice de segurança (0–100) baseado nos checks abaixo.</p>
              </div>
            </div>

            <div className="space-y-3">
              {data.checks.map((check) => (
                <div key={check.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
                  ) : (
                    <ShieldAlert className="mt-0.5 size-5 shrink-0 text-brand" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-paper">{check.label}</p>
                    {check.detail ? <p className="mt-0.5 text-xs text-muted">{check.detail}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Sem dados de segurança disponíveis."
            className="rounded-2xl border border-line bg-surface p-10"
          />
        )}
      </div>
    </CapabilityGate>
  );
}