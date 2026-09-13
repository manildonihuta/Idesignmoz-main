"use client";

import { useState } from "react";
import { BellOff, RefreshCw, TriangleAlert } from "lucide-react";

import { Button, EmptyState, Modal, useToast, Table, type Column } from "@/components/ui/core";
import type { ResourceAlert } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, useHostingPanel, CapabilityGate, AlertTonePill, fmtDate } from "@/components/hosting/hosting-shared";

export default function HostingAlertsView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const { data, error, loading, reload, setData } = useSectionData(`alerts-${hostingId}`, () =>
    hostingApi.alerts(hostingId).then((r) => r.alerts),
  );
  const { toast } = useToast();
  const [target, setTarget] = useState<ResourceAlert | null>(null);
  const [busy, setBusy] = useState(false);

  async function ack() {
    if (!target) return;
    setBusy(true);
    try {
      await hostingApi.ackAlert(hostingId, target.id);
      setData((data ?? []).map((a) => (a.id === target.id ? { ...a, status: "acked", ackedAt: new Date().toISOString() } : a)));
      setTarget(null);
      toast("ok", "Alerta resolvido.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao resolver o alerta.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ResourceAlert>[] = [
    { key: "level", header: "Nível", render: (a) => <AlertTonePill level={a.level} /> },
    { key: "kind", header: "Tipo", render: (a) => <span className="text-sm text-muted">{a.kind}</span> },
    { key: "message", header: "Mensagem", render: (a) => <span className="text-sm text-paper">{a.message}</span> },
    { key: "created_at", header: "Detetado", render: (a) => <span className="text-sm text-muted">{fmtDate(a.createdAt)}</span> },
    {
      key: "status",
      header: "Estado",
      render: (a) => (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted">{a.status === "acked" ? "Resolvido" : "Aberto"}</span>
          {a.status === "open" ? (
            <Button variant="ghost" size="sm" type="button" onClick={() => setTarget(a)} disabled={busy}>
              <BellOff className="mr-1.5 size-4" />
              Resolver
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <CapabilityGate capabilities={capabilities} required="alerts" feature="Alertas de recursos">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display-2 text-lg font-semibold tracking-tight">Alertas</h2>
            <p className="mt-1 text-sm text-muted">Quotas de armazenamento, SSL a expirar e estados offline detetados pelo monitor.</p>
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={() => void reload()}>
            <RefreshCw className="mr-1.5 size-4" />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">A carregar…</p>
        ) : error ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-brand">{error}</p>
        ) : data && data.length ? (
          <Table columns={columns} rows={data} rowKey={(row) => row.id} />
        ) : (
          <EmptyState
            icon={TriangleAlert}
            title="Sem alertas em aberto."
            description="Conta saudável."
            className="rounded-2xl border border-line bg-surface p-10"
          />
        )}

        {target ? (
          <Modal
            open
            onClose={() => setTarget(null)}
            title="Resolver alerta"
            description="Marcar como resolvido para não voltar a aparecer no painel."
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setTarget(null)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="button" onClick={() => void ack()} loading={busy}>
                  Resolver
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted">{target.message}</p>
          </Modal>
        ) : null}
      </div>
    </CapabilityGate>
  );
}