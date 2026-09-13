"use client";

import { useState } from "react";
import { Archive, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";

import { Button, EmptyState, Modal, TextField, SelectField, useToast, Table, type Column, StatusBadge } from "@/components/ui/core";
import type { HostingBackup } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, useHostingPanel, CapabilityGate, BackupStatusPill, fmtBytes, fmtDate } from "@/components/hosting/hosting-shared";

export default function HostingBackupsView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const { data, error, loading, reload, setData } = useSectionData(`backups-${hostingId}`, () =>
    hostingApi.backups(hostingId).then((r) => r.backups),
  );
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ label: "", kind: "full" });
  const [restoreTarget, setRestoreTarget] = useState<HostingBackup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HostingBackup | null>(null);

  async function create() {
    setBusy(true);
    try {
      const result = await hostingApi.createBackup(hostingId, { label: form.label || undefined, kind: form.kind });
      setData([result.backup, ...(data ?? [])]);
      setCreateOpen(false);
      setForm({ label: "", kind: "full" });
      toast("ok", "Backup criado — fica pronto em instantes.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao criar o backup.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      const result = await hostingApi.restoreBackup(hostingId, restoreTarget.id);
      setData((data ?? []).map((b) => (b.id === restoreTarget.id ? result.backup : b)));
      setRestoreTarget(null);
      toast("ok", "Restauro iniciado.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao restaurar o backup.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await hostingApi.deleteBackup(hostingId, deleteTarget.id);
      setData((data ?? []).filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast("ok", "Backup removido.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao remover o backup.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<HostingBackup>[] = [
    {
      key: "label",
      header: "Backup",
      render: (b) => <span className="font-medium text-paper">{b.label}</span>,
    },
    { key: "kind", header: "Tipo", render: (b) => <span className="text-sm text-muted">{b.kind}</span> },
    { key: "status", header: "Estado", render: (b) => <BackupStatusPill status={b.status} /> },
    { key: "size_mb", header: "Tamanho", render: (b) => <span className="text-sm text-muted">{fmtBytes(b.sizeMb * 1024 * 1024)}</span> },
    {
      key: "created_at",
      header: "Criado",
      render: (b) => <span className="text-sm text-muted">{fmtDate(b.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (b) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={b.status === "queued" || b.status === "processing" || b.status === "restoring"}
            onClick={() => setRestoreTarget(b)}
            aria-label={`Restaurar ${b.label}`}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget(b)} aria-label={`Remover ${b.label}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <CapabilityGate capabilities={capabilities} required="backups" feature="Backups">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display-2 text-lg font-semibold tracking-tight">Backups</h2>
            <p className="mt-1 text-sm text-muted">Cópias do estado da conta (sites + bases de dados). Restauro repõe esse estado.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => void reload()}>
              <RefreshCw className="mr-1.5 size-4" />
              Atualizar
            </Button>
            <Button variant="brand" size="sm" type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Criar backup
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">A carregar…</p>
        ) : error ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-brand">{error}</p>
        ) : data && data.length ? (
          <Table columns={columns} rows={data} rowKey={(row) => row.id} />
        ) : (
          <EmptyState
            icon={Archive}
            title="Ainda não há backups."
            description="Cria o primeiro para proteger a conta."
            className="rounded-2xl border border-line bg-surface p-10"
          />
        )}

        {createOpen ? (
          <Modal
            open
            onClose={() => setCreateOpen(false)}
            title="Criar backup"
            description="Guarda uma fotografia do estado atual da conta."
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setCreateOpen(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="submit" form="hosting-backup-form" loading={busy}>
                  Criar backup
                </Button>
              </>
            }
          >
            <form id="hosting-backup-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <TextField
                label="Rótulo (opcional)"
                placeholder="Antes da atualização grande"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
              <SelectField
                label="Tipo"
                options={[
                  { value: "full", label: "Completo (sites + bases)" },
                  { value: "website", label: "Apenas sites" },
                  { value: "database", label: "Apenas bases de dados" },
                ]}
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              />
            </form>
          </Modal>
        ) : null}

        {restoreTarget ? (
          <Modal
            open
            onClose={() => setRestoreTarget(null)}
            title="Restaurar backup"
            description={`Restaurar "${restoreTarget.label}" repõe sites e bases de dados para o estado gravado.`}
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setRestoreTarget(null)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="button" onClick={() => void restore()} loading={busy}>
                  Restaurar
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted">
              <StatusBadge tone="warn">Atenção</StatusBadge>{" "}
              O restauro substitui o estado atual pelos dados deste backup. Se o website for suspenso, ficará no estado anterior.
            </p>
          </Modal>
        ) : null}

        {deleteTarget ? (
          <Modal
            open
            onClose={() => setDeleteTarget(null)}
            title="Remover backup"
            description={`Vais apagar o backup "${deleteTarget.label}".`}
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget(null)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="button" onClick={() => void remove()} loading={busy}>
                  Remover
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted">O backup deixa de estar disponível para restauro.</p>
          </Modal>
        ) : null}
      </div>
    </CapabilityGate>
  );
}