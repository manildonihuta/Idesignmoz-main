"use client";

import { History } from "lucide-react";

import { EmptyState, LoadingIndicator } from "@/components/ui/core";
import type { HostingActivityEntry } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, fmtDate } from "@/components/hosting/hosting-shared";

export default function HostingActivityView({ hostingId }: { hostingId: string }) {
  const { data, error, loading } = useSectionData<HostingActivityEntry[]>(`act-${hostingId}`, () =>
    hostingApi.activity(hostingId).then((r) => r.activities),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display-2 text-lg font-semibold tracking-tight">Atividade</h2>
        <p className="mt-1 text-sm text-muted">Registo de alterações feitas nesta conta de alojamento.</p>
      </div>

      {loading ? (
        <LoadingIndicator label="A carregar atividade…" />
      ) : error ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-brand">{error}</p>
      ) : data && data.length ? (
        <div className="space-y-3">
          {data.map((entry, i) => (
            <div key={`${entry.action}-${entry.createdAt}-${i}`} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-ok" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-paper">{entry.action}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {entry.actorEmail ?? "Sistema"} · {fmtDate(entry.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={History}
          title="Sem atividade registada."
          className="rounded-2xl border border-line bg-surface p-10"
        />
      )}
    </div>
  );
}