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

export function EmailServiceView({ service: initial }: { service: ClientEmailServiceDetail }) {
  const [service, setService] = useState(initial);
  const [localPart, setLocalPart] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMailbox, setBusyMailbox] = useState<string | null>(null);

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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}