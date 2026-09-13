"use client";

import { useState } from "react";
import { Lock, Plus, RefreshCw, RotateCcw, ShieldOff } from "lucide-react";

import { Button, EmptyState, Modal, TextField, useToast, Table, type Column } from "@/components/ui/core";
import type { HostingSslCertificate } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { useSectionData, useHostingPanel, CapabilityGate, SslStatusPill, fmtDate } from "@/components/hosting/hosting-shared";

export default function HostingSslView({ hostingId }: { hostingId: string }) {
  const { bundle } = useHostingPanel();
  const capabilities = bundle?.provider.capabilities;
  const account = bundle?.account;
  const { data, error, loading, reload, setData } = useSectionData(`ssl-${hostingId}`, () =>
    hostingApi.ssl(hostingId).then((r) => r.certificates),
  );
  const { toast } = useToast();
  const [installOpen, setInstallOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState(account?.domain ?? "");
  const [removal, setRemoval] = useState<HostingSslCertificate | null>(null);

  async function install() {
    setBusy(true);
    try {
      const result = await hostingApi.installSsl(hostingId, domain);
      setData([result.certificate, ...(data ?? [])]);
      setInstallOpen(false);
      toast("ok", "SSL instalado.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao instalar o SSL.");
    } finally {
      setBusy(false);
    }
  }

  async function renew(cert: HostingSslCertificate) {
    setBusy(true);
    try {
      const result = await hostingApi.renewSsl(hostingId, cert.id);
      setData((data ?? []).map((c) => (c.id === cert.id ? result.certificate : c)));
      toast("ok", "Renovação de SSL iniciada.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao renovar o SSL.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removal) return;
    setBusy(true);
    try {
      await hostingApi.removeSsl(hostingId, removal.id);
      setData((data ?? []).filter((c) => c.id !== removal.id));
      setRemoval(null);
      toast("ok", "SSL removido.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Erro ao remover o SSL.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<HostingSslCertificate>[] = [
    { key: "domain", header: "Domínio", render: (c) => <span className="font-medium text-paper">{c.domain}</span> },
    { key: "provider", header: "Provedor", render: (c) => <span className="text-sm text-muted">{c.provider}</span> },
    { key: "status", header: "Estado", render: (c) => <SslStatusPill status={c.status} /> },
    { key: "expires_at", header: "Expira", render: (c) => <span className="text-sm text-muted">{fmtDate(c.expiresAt)}</span> },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" type="button" onClick={() => void renew(c)} disabled={busy} aria-label={`Renovar ${c.domain}`}>
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => setRemoval(c)} disabled={busy} aria-label={`Remover ${c.domain}`}>
            <ShieldOff className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <CapabilityGate capabilities={capabilities} required="ssl" feature="Certificados SSL">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display-2 text-lg font-semibold tracking-tight">SSL / TLS</h2>
            <p className="mt-1 text-sm text-muted">Certificados da conta — renovação automática ligada por omissão.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => void reload()}>
              <RefreshCw className="mr-1.5 size-4" />
              Atualizar
            </Button>
            <Button variant="brand" size="sm" type="button" onClick={() => setInstallOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Instalar SSL
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
            icon={Lock}
            title="Ainda não há certificados SSL."
            description="Instala um para o teu domínio."
            className="rounded-2xl border border-line bg-surface p-10"
          />
        )}

        {installOpen ? (
          <Modal
            open
            onClose={() => setInstallOpen(false)}
            title="Instalar SSL"
            description="Emite um certificado Let's Encrypt para o domínio."
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setInstallOpen(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="submit" form="hosting-ssl-form" loading={busy}>
                  Instalar
                </Button>
              </>
            }
          >
            <form id="hosting-ssl-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void install(); }}>
              <TextField
                label="Domínio"
                placeholder="exemplo.pt"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
              <p className="text-xs text-muted">Se o domínio não for apontado para este alojamento, a emissão pode ficar pendente.</p>
            </form>
          </Modal>
        ) : null}

        {removal ? (
          <Modal
            open
            onClose={() => setRemoval(null)}
            title="Remover certificado SSL"
            description={`Vais remover o SSL de ${removal.domain}. O site passa a servir sem HTTPS.`}
            footer={
              <>
                <Button variant="ghost" size="sm" type="button" onClick={() => setRemoval(null)} disabled={busy}>
                  Cancelar
                </Button>
                <Button variant="brand" size="sm" type="button" onClick={() => void remove()} loading={busy}>
                  Remover
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted">Depois de removido, o certificado deixa de ser renovado automaticamente.</p>
          </Modal>
        ) : null}
      </div>
    </CapabilityGate>
  );
}