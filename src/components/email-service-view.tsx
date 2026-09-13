"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { ClientEmailMailbox, ClientEmailServiceDetail } from "@/lib/client-data";

const SERVICE_STATUS: Record<string, { label: string; tone: string }> = {
  provisioning: { label: "A aprovisionar", tone: "text-amber-600" },
  active: { label: "Ativo", tone: "text-emerald-600" },
  suspended: { label: "Suspenso", tone: "text-red-600" },
  error: { label: "Erro", tone: "text-red-600" },
  cancelled: { label: "Cancelado", tone: "text-muted" },
};

const MAILBOX_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativa", tone: "text-emerald-600" },
  suspended: { label: "Suspensa", tone: "text-red-600" },
  provisioning: { label: "A aprovisionar", tone: "text-amber-600" },
  full: { label: "Cheia", tone: "text-amber-600" },
  error: { label: "Erro", tone: "text-red-600" },
};

function fmt(date: string | null): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return date;
  }
}

function MailboxFeaturePanel({
  mailbox,
  serviceId,
  onRefresh,
}: {
  mailbox: ClientEmailMailbox;
  serviceId: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fwdText, setFwdText] = useState(mailbox.forwardTo.join(", "));
  const [arEnabled, setArEnabled] = useState(mailbox.autoresponder?.enabled ?? false);
  const [arSubject, setArSubject] = useState(mailbox.autoresponder?.subject ?? "");
  const [arBody, setArBody] = useState(mailbox.autoresponder?.body ?? "");
  const [arFromName, setArFromName] = useState(mailbox.autoresponder?.fromName ?? "");

  const saveForwarding = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const forwardTo = fwdText
        .split(/[,\n]+/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch(`/api/email/services/${serviceId}/mailboxes/${mailbox.id}/forwarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forwardTo }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao guardar o reencaminhamento.");
        return;
      }
      setNotice("Reencaminhamento guardado.");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const saveAutoresponder = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/email/services/${serviceId}/mailboxes/${mailbox.id}/autoresponder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: arEnabled,
          subject: arSubject,
          body: arBody,
          fromName: arFromName || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao guardar o respondedor automático.");
        return;
      }
      setNotice("Respondedor automático guardado.");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-muted hover:text-text"
      >
        {open ? "▾" : "▸"} Funcionalidades
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{notice}</div>}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Reencaminhamento</h3>
            <p className="text-xs text-muted">Lista de endereços separados por vírgula. Vazio desativa o reencaminhamento.</p>
            <textarea
              value={fwdText}
              onChange={(e) => setFwdText(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
              placeholder="destino1@site.com, destino2@outro.pt"
            />
            <button className="outline-button px-3 py-1 text-xs" disabled={busy} onClick={saveForwarding}>
              Guardar reencaminhamento
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Respondedor automático</h3>
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={arEnabled}
                  onChange={(e) => setArEnabled(e.target.checked)}
                  className="accent-emerald-600"
                />
                Ativo
              </label>
            </div>
            <input
              type="text"
              value={arSubject}
              onChange={(e) => setArSubject(e.target.value)}
              disabled={!arEnabled}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Assunto da resposta"
            />
            <textarea
              value={arBody}
              onChange={(e) => setArBody(e.target.value)}
              disabled={!arEnabled}
              rows={4}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Mensagem automática (suporta HTML simples)"
            />
            <input
              type="text"
              value={arFromName}
              onChange={(e) => setArFromName(e.target.value)}
              disabled={!arEnabled}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Nome remetente (opcional)"
            />
            <button className="outline-button px-3 py-1 text-xs" disabled={busy} onClick={saveAutoresponder}>
              Guardar respondedor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailServiceView({ service: initial }: { service: ClientEmailServiceDetail }) {
  const [service, setService] = useState(initial);
  const [localPart, setLocalPart] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [aliasLocal, setAliasLocal] = useState("");
  const [aliasDest, setAliasDest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMailbox, setBusyMailbox] = useState<string | null>(null);
  const [busyAlias, setBusyAlias] = useState<string | null>(null);

  const status = SERVICE_STATUS[service.status] ?? { label: service.status, tone: "" };
  const mbStatus = (s: string) => MAILBOX_STATUS[s] ?? { label: s, tone: "" };

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/email/services/${service.id}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { service?: ClientEmailServiceDetail };
      if (data.service) setService(data.service);
    }
  }, [service.id]);

  const createMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/email/services/${service.id}/mailboxes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPart, password, displayName }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; mailbox?: ClientEmailMailbox };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível criar a caixa.");
        return;
      }
      setLocalPart("");
      setPassword("");
      setDisplayName("");
      setNotice(`Caixa ${data.mailbox?.emailAddress ?? ""} criada.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (
    mailbox: ClientEmailMailbox,
    action: "suspend" | "resume" | "delete",
  ) => {
    setError(null);
    setNotice(null);
    setBusyMailbox(mailbox.id);
    try {
      const res =
        action === "delete"
          ? await fetch(
              `/api/email/services/${service.id}/mailboxes/${mailbox.id}`,
              { method: "DELETE" },
            )
          : await fetch(
              `/api/email/services/${service.id}/mailboxes/${mailbox.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
              },
            );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha na operação.");
        return;
      }
      setNotice(
        action === "delete"
          ? `Caixa ${mailbox.emailAddress} removida.`
          : action === "suspend"
            ? `Caixa ${mailbox.emailAddress} suspensa.`
            : `Caixa ${mailbox.emailAddress} reativada.`,
      );
      await refresh();
    } finally {
      setBusyMailbox(null);
    }
  };

  const canCreate = useMemo(
    () =>
      service.status === "active" &&
      service.mailboxes.filter((m) => m.status === "active").length < service.mailboxLimit,
    [service],
  );

  const createAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/email/services/${service.id}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPart: aliasLocal, destination: aliasDest }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; alias?: { aliasAddress?: string } };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível criar o alias.");
        return;
      }
      setAliasLocal("");
      setAliasDest("");
      setNotice(`Alias ${data.alias?.aliasAddress ?? ""} criado.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteAlias = async (aliasId: string, aliasAddress: string) => {
    setError(null);
    setNotice(null);
    setBusyAlias(aliasId);
    try {
      const res = await fetch(`/api/email/services/${service.id}/aliases/${aliasId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao remover o alias.");
        return;
      }
      setNotice(`Alias ${aliasAddress} removido.`);
      await refresh();
    } finally {
      setBusyAlias(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/email" className="text-sm text-muted hover:underline">
            ← Voltar a Email
          </Link>
          <h1 className="mt-1 font-display-2 text-2xl font-semibold tracking-tight">{service.domain}</h1>
          <p className="text-muted">
            {service.planName}
            {service.providerLabel ? ` · ${service.providerLabel}` : ""}
            {service.providerMode === "simulated" ? " · ambiente de simulação" : ""}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${status.tone}`}>{status.label}</div>
          <div className="text-xs text-muted">Renova {fmt(service.expiresAt)}</div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="text-sm text-muted">Caixas</div>
          <div className="mt-1 text-xl font-semibold">
            {service.mailboxes.filter((m) => m.status === "active").length}/{service.mailboxLimit}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="text-sm text-muted">Armazenamento</div>
          <div className="mt-1 text-xl font-semibold">{service.storageLimitGb} GB</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="text-sm text-muted">DNS</div>
          <div className="mt-1 text-xl font-semibold capitalize">{service.dnsStatus}</div>
        </div>
      </div>

      {canCreate && (
        <form onSubmit={createMailbox} className="rounded-xl border border-line bg-surface p-5 space-y-3">
          <h2 className="font-display-2 text-lg font-semibold">Nova caixa de email</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-muted">Nome da caixa</span>
              <input
                type="text"
                required
                pattern="[a-zA-Z0-9._-]+"
                placeholder="info"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
              />
              <span className="text-xs text-muted">@{service.domain}</span>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Nome de exibição (opcional)</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button type="submit" disabled={busy} className="button">
            {busy ? "A criar…" : "Criar caixa"}
          </button>
          <p className="text-xs text-muted">
            A password é enviada de forma segura para o fornecedor e nunca é guardada nos nossos sistemas.
          </p>
        </form>
      )}

      <div className="space-y-3">
        <h2 className="font-display-2 text-lg font-semibold">
          Caixas ({service.mailboxes.length})
        </h2>
        {!service.mailboxes.length ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
            Ainda não tem caixas neste serviço. Crie a primeira caixa acima.
          </div>
        ) : (
          service.mailboxes.map((m) => {
            const st = mbStatus(m.status);
            return (
              <div key={m.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold">{m.emailAddress}</div>
                    {m.displayName && <div className="text-sm text-muted">{m.displayName}</div>}
                  </div>
                  <span className={`text-sm font-medium ${st.tone}`}>{st.label}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="text-muted">
                    {m.storageUsedGb} / {m.storageLimitGb} GB
                  </span>
                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, m.quotaPercent || 0)}%` }}
                    />
                  </div>
                  {m.status === "active" && (
                    <button
                      className="outline-button px-3 py-1 text-xs"
                      disabled={busyMailbox === m.id}
                      onClick={() => runAction(m, "suspend")}
                    >
                      Suspender
                    </button>
                  )}
                  {m.status === "suspended" && (
                    <button
                      className="outline-button px-3 py-1 text-xs"
                      disabled={busyMailbox === m.id}
                      onClick={() => runAction(m, "resume")}
                    >
                      Reativar
                    </button>
                  )}
                  <button
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    disabled={busyMailbox === m.id}
                    onClick={() => {
                      if (window.confirm(`Remover a caixa ${m.emailAddress}?`)) runAction(m, "delete");
                    }}
                  >
                    Remover
                  </button>
                </div>
                {m.status === "active" && (
                  <MailboxFeaturePanel mailbox={m} serviceId={service.id} onRefresh={refresh} />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display-2 text-lg font-semibold">
          Aliases ({service.aliases.length})
        </h2>

        {service.status === "active" && (
          <form onSubmit={createAlias} className="rounded-xl border border-line bg-surface p-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-muted">Nome do alias</span>
                <input
                  type="text"
                  required
                  pattern="[a-zA-Z0-9._-]+"
                  placeholder="vendas"
                  value={aliasLocal}
                  onChange={(e) => setAliasLocal(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
                />
                <span className="text-xs text-muted">@{service.domain}</span>
              </label>
              <label className="block">
                <span className="text-xs text-muted">Destino (caixa ou endereço externo)</span>
                <input
                  type="email"
                  required
                  placeholder="info@site.com"
                  value={aliasDest}
                  onChange={(e) => setAliasDest(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button type="submit" disabled={busy} className="button">
              {busy ? "A criar…" : "Criar alias"}
            </button>
          </form>
        )}

        {!service.aliases.length ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
            Ainda não tem aliases. Um alias reencaminha um endereço para uma caixa (ex.: vendas@ → info@).
          </div>
        ) : (
          service.aliases.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
              <div>
                <div className="text-base font-semibold">{a.aliasAddress}</div>
                <div className="text-sm text-muted">→ {a.destination}</div>
              </div>
              <button
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
                disabled={busyAlias === a.id}
                onClick={() => {
                  if (window.confirm(`Remover o alias ${a.aliasAddress}?`)) deleteAlias(a.id, a.aliasAddress);
                }}
              >
                Remover
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}