"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button, Empty, Modal, TextField, SelectField, useToast, StatusBadge, Table, type Column } from "@/components/ui/core";
import type { HostingWebsite } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, useHostingPanel, WebsiteStatusPill, SslStatusPill, fmtBytes, fmtDate, CapabilityGate } from "@/components/hosting/hosting-shared";

export default function HostingWebsitesView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const plan = bundle?.plan;
  const { data, error, loading, reload, setData } = useSectionData(`sites-${hostingId}`, () =>
    hostingApi.websites(hostingId).then((r) => r.websites),
  );
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ domain: "", app: "", phpVersion: plan?.phpVersions[0] ?? "8.3" });
  const [deleteTarget, setDeleteTarget] = useState<HostingWebsite | null>(null);
  const [phpBusy, setPhpBusy] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    try {
      const result = await hostingApi.createWebsite(hostingId, {
        domain: form.domain,
        app: form.app || undefined,
        phpVersion: form.phpVersion,
      });
      setData([...(data ?? []), result.website]);
      setCreateOpen(false);
      setForm({ domain: "", app: "", phpVersion: plan?.phpVersions[0] ?? "8.3" });
      toast("ok", "Website criado.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao criar o website.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await hostingApi.deleteWebsite(hostingId, deleteTarget.id);
      setData((data ?? []).filter((w) => w.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast("ok", "Website removido.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao remover o website.");
    } finally {
      setBusy(false);
    }
  }

  async function changePhp(website: HostingWebsite, version: string) {
    if (version === website.phpVersion) return;
    setPhpBusy(website.id);
    try {
      const result = await hostingApi.setPhp(hostingId, website.id, version);
      setData((data ?? []).map((w) => (w.id === website.id ? result.website : w)));
      toast("ok", "Versão de PHP atualizada.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao atualizar o PHP.");
    } finally {
      setPhpBusy(null);
    }
  }

  const columns: Column<HostingWebsite>[] = [
    {
      key: "domain",
      header: "Domínio",
      render: (w) => (
        <div>
          <p className="font-medium text-paper">{w.domain}</p>
          {w.app ? <p className="text-xs text-muted">{w.app}</p> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (w) => <WebsiteStatusPill status={w.status} />,
    },
    {
      key: "ssl_status",
      header: "SSL",
      render: (w) => <SslStatusPill status={w.sslStatus} />,
    },
    {
      key: "php_version",
      header: "PHP",
      render: (w) =>
        capabilities?.includes("php") ? (
          <SelectField
            aria-label={`PHP de ${w.domain}`}
            className="w-28"
            options={
              (plan?.phpVersions ?? ["8.1", "8.2", "8.3"]).map((v) => ({
                value: v,
                label: v,
              }))
            }
            value={w.phpVersion ?? ""}
            disabled={phpBusy === w.id}
            onChange={(e) => void changePhp(w, e.target.value)}
          />
        ) : (
          <span className="text-sm text-muted">{w.phpVersion ?? "—"}</span>
        ),
    },
    {
      key: "storage_mb",
      header: "Armazenamento",
      render: (w) => <span className="text-sm text-muted">{fmtBytes(w.storageMb * 1024 * 1024)}</span>,
    },
    {
      key: "created_at",
      header: "Criado",
      render: (w) => <span className="text-sm text-muted">{fmtDate(w.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (w) => (
        <Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget(w)} aria-label={`Remover ${w.domain}`}>
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <CapabilityGate capabilities={capabilities} required="websites" feature="Sites">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display-2 text-lg font-semibold tracking-tight">Sites</h2>
            <p className="mt-1 text-sm text-muted">Websites alojados nesta conta — domínio, PHP, SSL e estado.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => void reload()}>
              <RefreshCw className="mr-1.5 size-4" />
              Atualizar
            </Button>
            <Button variant="brand" size="sm" type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Adicionar site
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
          <Empty text="Ainda não há websites nesta conta." className="rounded-2xl border border-line bg-surface p-10" />
        )}

        {createOpen ? (
          <Modal
            open
            onClose={() => setCreateOpen(false)}
            title="Adicionar site"
            description="Cria um website na conta de alojamento."
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setCreateOpen(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="submit" form="hosting-site-form" loading={busy}>
                  Criar website
                </Button>
              </>
            }
          >
            <form id="hosting-site-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <TextField
                label="Domínio"
                placeholder="exemplo.pt"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                required
              />
              <TextField
                label="Aplicação (opcional)"
                placeholder="WordPress, Laravel…"
                value={form.app}
                onChange={(e) => setForm({ ...form, app: e.target.value })}
              />
              <SelectField
                label="Versão de PHP"
                options={(plan?.phpVersions ?? ["8.1", "8.2", "8.3"]).map((v) => ({ value: v, label: `PHP ${v}` }))}
                value={form.phpVersion}
                onChange={(e) => setForm({ ...form, phpVersion: e.target.value })}
              />
            </form>
          </Modal>
        ) : null}

        {deleteTarget ? (
          <Modal
            open
            onClose={() => setDeleteTarget(null)}
            title="Remover website"
            description={`Vais remover ${deleteTarget.domain} desta conta.`}
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
              <StatusBadge tone="danger">Ação irreversível</StatusBadge>{" "}
              O website deixa de estar associado à conta. Nenhum ficheiro real é apagado enquanto o provider não estiver ligado.
            </p>
          </Modal>
        ) : null}
      </div>
    </CapabilityGate>
  );
}