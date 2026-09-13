"use client";

import { useState } from "react";
import { KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button, Empty, Modal, TextField, SelectField, useToast, Table, type Column, StatusBadge } from "@/components/ui/core";
import type { HostingDatabase } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, useHostingPanel, CapabilityGate, fmtBytes, fmtDate } from "@/components/hosting/hosting-shared";

type RevealedPassword = { dbName: string; user: string; password: string };

export default function HostingDatabasesView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const { data, error, loading, reload, setData } = useSectionData(`dbs-${hostingId}`, () =>
    hostingApi.databases(hostingId).then((r) => r.databases),
  );
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", engine: "mysql" });
  const [deleteTarget, setDeleteTarget] = useState<HostingDatabase | null>(null);
  const [revealed, setRevealed] = useState<RevealedPassword | null>(null);

  async function create() {
    setBusy(true);
    try {
      const result = await hostingApi.createDatabase(hostingId, form.name);
      setData([...(data ?? []), result.database]);
      setRevealed({ dbName: result.database.name, user: result.database.dbUser ?? result.database.name, password: result.password });
      setCreateOpen(false);
      setForm({ name: "", engine: "mysql" });
      toast("ok", "Base de dados criada.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao criar a base de dados.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(db: HostingDatabase) {
    setBusy(true);
    try {
      const result = await hostingApi.resetDatabasePassword(hostingId, db.id);
      setRevealed({ dbName: db.name, user: db.dbUser ?? db.name, password: result.password });
      toast("ok", "Palavra-passe reposta. Guarda-a agora — só é mostrada uma vez.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao repor a palavra-passe.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await hostingApi.deleteDatabase(hostingId, deleteTarget.id);
      setData((data ?? []).filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast("ok", "Base de dados removida.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao remover a base de dados.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<HostingDatabase>[] = [
    {
      key: "name",
      header: "Nome",
      render: (d) => <span className="font-medium text-paper">{d.name}</span>,
    },
    { key: "engine", header: "Motor", render: (d) => <span className="text-sm text-muted">{d.engine}</span> },
    {
      key: "size_mb",
      header: "Tamanho",
      render: (d) => <span className="text-sm text-muted">{fmtBytes(d.sizeMb * 1024 * 1024)}</span>,
    },
    {
      key: "db_user",
      header: "Utilizador",
      render: (d) => <span className="text-sm text-muted">{d.dbUser ?? "—"}</span>,
    },
    {
      key: "created_at",
      header: "Criada",
      render: (d) => <span className="text-sm text-muted">{fmtDate(d.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" type="button" onClick={() => void resetPassword(d)} aria-label={`Repor palavra-passe de ${d.name}`}>
            <KeyRound className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget(d)} aria-label={`Remover ${d.name}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <CapabilityGate capabilities={capabilities} required="databases" feature="Bases de dados">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display-2 text-lg font-semibold tracking-tight">Bases de dados</h2>
            <p className="mt-1 text-sm text-muted">Bases MySQL/PostgreSQL da conta. As credenciais só são mostradas uma vez.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => void reload()}>
              <RefreshCw className="mr-1.5 size-4" />
              Atualizar
            </Button>
            <Button variant="brand" size="sm" type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Criar base de dados
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
          <Empty text="Ainda não há bases de dados nesta conta." className="rounded-2xl border border-line bg-surface p-10" />
        )}

        {createOpen ? (
          <Modal
            open
            onClose={() => setCreateOpen(false)}
            title="Criar base de dados"
            description="A base de dados fica associada à tua conta cPanel-style."
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setCreateOpen(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="submit" form="hosting-db-form" loading={busy}>
                  Criar
                </Button>
              </>
            }
          >
            <form id="hosting-db-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <TextField
                label="Nome"
                placeholder="aplicacao_principal"
                pattern="[a-z][a-z0-9_]{0,62}"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <SelectField
                label="Motor"
                options={[
                  { value: "mysql", label: "MySQL" },
                  { value: "postgresql", label: "PostgreSQL" },
                ]}
                value={form.engine}
                onChange={(e) => setForm({ ...form, engine: e.target.value })}
              />
              <p className="text-xs text-muted">A palavra-passe é gerada automaticamente e mostrada apenas uma vez.</p>
            </form>
          </Modal>
        ) : null}

        {revealed ? (
          <Modal
            open
            onClose={() => setRevealed(null)}
            title="Credenciais da base de dados"
            description={`Guarda estas credenciais — só aparecem agora uma única vez.`}
            footer={
              <Button variant="brand" size="sm" type="button" onClick={() => setRevealed(null)}>
                Concluído
              </Button>
            }
          >
            <div className="space-y-3 rounded-xl border border-line bg-ink p-4 font-mono text-sm">
              <p>
                <span className="text-muted">Base:</span>{" "}
                <span className="text-paper">{revealed.dbName}</span>
              </p>
              <p>
                <span className="text-muted">Utilizador:</span> <span className="text-paper">{revealed.user}</span>
              </p>
              <p>
                <span className="text-muted">Palavra-passe:</span> <span className="text-paper">{revealed.password}</span>
              </p>
            </div>
          </Modal>
        ) : null}

        {deleteTarget ? (
          <Modal
            open
            onClose={() => setDeleteTarget(null)}
            title="Remover base de dados"
            description={`Vais remover a base "${deleteTarget.name}".`}
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
            <p className="text-sm text-muted">
              <StatusBadge tone="danger">Ação irreversível</StatusBadge> A base fica inativa na conta.
            </p>
          </Modal>
        ) : null}
      </div>
    </CapabilityGate>
  );
}