"use client";

import { useState } from "react";
import { Plus, RefreshCw, Terminal, Trash2 } from "lucide-react";

import { Button, EmptyState, Modal, TextField, useToast, Table, type Column, StatusBadge } from "@/components/ui/core";
import type { HostingCronJob } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, useHostingPanel, CapabilityGate, fmtDate } from "@/components/hosting/hosting-shared";

export default function HostingAdvancedView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const { data, error, loading, reload, setData } = useSectionData(`cron-${hostingId}`, () =>
    hostingApi.cron(hostingId).then((r) => r.jobs),
  );
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ command: "", schedule: "0 * * * *" });
  const [deleteTarget, setDeleteTarget] = useState<HostingCronJob | null>(null);

  async function create() {
    setBusy(true);
    try {
      const result = await hostingApi.createCron(hostingId, { command: form.command, schedule: form.schedule });
      setData([result.job, ...(data ?? [])]);
      setCreateOpen(false);
      setForm({ command: "", schedule: "0 * * * *" });
      toast("ok", "Tarefa agendada criada.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao criar a tarefa.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(job: HostingCronJob) {
    setBusy(true);
    try {
      const next = job.status === "enabled" ? "disabled" : "enabled";
      const result = await hostingApi.updateCron(hostingId, job.id, { status: next });
      setData((data ?? []).map((j) => (j.id === job.id ? result.job : j)));
      toast("ok", next === "enabled" ? "Tarefa ativada." : "Tarefa desativada.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao atualizar a tarefa.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await hostingApi.deleteCron(hostingId, deleteTarget.id);
      setData((data ?? []).filter((j) => j.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast("ok", "Tarefa removida.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao remover a tarefa.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<HostingCronJob>[] = [
    {
      key: "command",
      header: "Comando",
      render: (j) => <span className="font-mono text-xs text-paper">{j.command}</span>,
    },
    { key: "schedule", header: "Agendar", render: (j) => <span className="font-mono text-xs text-muted">{j.schedule}</span> },
    {
      key: "status",
      header: "Estado",
      render: (j) => <StatusBadge tone={j.status === "enabled" ? "ok" : "muted"}>{j.status}</StatusBadge>,
    },
    { key: "last_run_at", header: "Última execução", render: (j) => <span className="text-sm text-muted">{fmtDate(j.lastRunAt)}</span> },
    {
      key: "actions",
      header: "",
      render: (j) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" type="button" onClick={() => void toggle(j)} disabled={busy}>
            {j.status === "enabled" ? "Desativar" : "Ativar"}
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget(j)} aria-label={`Remover ${j.command}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <CapabilityGate capabilities={capabilities} required="cron" feature="Tarefas agendadas (cron)">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display-2 text-lg font-semibold tracking-tight">Avançado</h2>
            <p className="mt-1 text-sm text-muted">Tarefas cron agendadas (crontab) e ferramentas de administração.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => void reload()}>
              <RefreshCw className="mr-1.5 size-4" />
              Atualizar
            </Button>
            <Button variant="brand" size="sm" type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Nova tarefa
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
            icon={Terminal}
            title="Sem tarefas agendadas."
            description="Cria a primeira quando precisares de automatizar."
            className="rounded-2xl border border-line bg-surface p-10"
          />
        )}

        {createOpen ? (
          <Modal
            open
            onClose={() => setCreateOpen(false)}
            title="Nova tarefa cron"
            description="Comando executado segundo o agendamento (formato crontab de 5 campos)."
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setCreateOpen(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="submit" form="hosting-cron-form" loading={busy}>
                  Criar
                </Button>
              </>
            }
          >
            <form id="hosting-cron-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <TextField
                label="Comando"
                placeholder="php /home/user/cron.php"
                className="font-mono"
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                required
              />
              <TextField
                label="Agendamento"
                placeholder="0 * * * *"
                className="font-mono"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                required
              />
            </form>
          </Modal>
        ) : null}

        {deleteTarget ? (
          <Modal
            open
            onClose={() => setDeleteTarget(null)}
            title="Remover tarefa"
            description={`Vais remover a tarefa "${deleteTarget.command}".`}
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
            <p className="text-sm text-muted">A tarefa deixa de ser executada.</p>
          </Modal>
        ) : null}
      </div>
    </CapabilityGate>
  );
}