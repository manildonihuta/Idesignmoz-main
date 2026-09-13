"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { generateReference, PAYMENT_METHODS } from "@/lib/payment-providers";
import type { ClientEmailMailbox, ClientEmailServiceDetail } from "@/lib/client-data";

function quotaPercent(usedGb: number, limitGb: number): number {
  return limitGb > 0 ? Math.min(100, Math.round((usedGb / limitGb) * 100)) : 0;
}

function quotaBarClass(pct: number): string {
  if (pct >= 95) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function QuotaBanner({ usage, domain }: { usage: { storageUsedGb: number; storageLimitGb: number }; domain: string }) {
  const pct = quotaPercent(usage.storageUsedGb, usage.storageLimitGb);
  if (pct < 80) return null;
  const critical = pct >= 95;
  return (
    <div
      className={
        critical
          ? "rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          : "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
      }
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">
            {critical ? "Armazenamento de email quase cheio" : "Armazenamento de email a atingir o limite"}
          </p>
          <p className="text-xs">
            {domain} está a {pct}% ({usage.storageUsedGb} de {usage.storageLimitGb} GB).{" "}
            {critical
              ? "Acima deste limite as caixas podem deixar de receber email. Apaga arquivos antigos ou aumenta o plano."
              : "Considera apagar arquivos antigos ou aumentar o plano."}
          </p>
        </div>
      </div>
    </div>
  );
}

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

const DNS_STATUS: Record<string, string> = {
  none: "Sem DNS",
  pending: "Pendente",
  verifying: "A verificar",
  verified: "Verificado",
  failed: "Incompleto",
  external: "Externo",
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
  const [newPassword, setNewPassword] = useState("");

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

  const resetPassword = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/email/services/${serviceId}/mailboxes/${mailbox.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao redefinir a password.");
        return;
      }
      setNewPassword("");
      setNotice("Password redefinida com sucesso.");
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

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Segurança</h3>
            <p className="text-xs text-muted">
              A password é aplicada no fornecedor e nunca é guardada nos nossos sistemas.
              {mailbox.passwordChangedAt ? ` Última alteração: ${fmt(mailbox.passwordChangedAt)}.` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                className="flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm"
                placeholder="Nova password (mín. 8 caracteres)"
              />
              <button
                className="outline-button px-3 py-1 text-xs"
                disabled={busy || newPassword.length < 8}
                onClick={resetPassword}
              >
                Redefinir password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDateTime(date: string | null): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date;
  }
}

function UsagePanel({
  service,
  onRefresh,
}: {
  service: ClientEmailServiceDetail;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sync = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/email/services/${service.id}/usage/sync`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string; usage?: { recordedAt?: string } };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao sincronizar o uso.");
        return;
      }
      setNotice("Uso sincronizado com o fornecedor.");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const { usage } = service;
  const pct = quotaPercent(usage.storageUsedGb, usage.storageLimitGb);

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display-2 text-lg font-semibold">Uso &amp; segurança</h2>
          <p className="text-sm text-muted">
            Última sincronização: {fmtDateTime(usage.recordedAt)} · {usage.storageUsedGb} GB utilizados de{" "}
            {usage.storageLimitGb} GB
          </p>
        </div>
        <button className="outline-button px-3 py-1 text-sm" disabled={busy} onClick={sync}>
          {busy ? "A sincronizar…" : "Sincronizar uso"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="text-xs text-muted">Armazenamento</div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="font-semibold">
              {usage.storageUsedGb} / {usage.storageLimitGb} GB
            </span>
            <span className="text-xs text-muted">({pct}%)</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full ${quotaBarClass(pct)}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="text-xs text-muted">Caixas</div>
          <div className="mt-1 text-sm font-semibold">
            {usage.mailboxesUsed} / {usage.mailboxesLimit}
          </div>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      {notice && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{notice}</div>}

      {service.usageHistory.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Histórico</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-1 pr-3 font-medium">Data</th>
                  <th className="py-1 pr-3 font-medium">Armazenamento</th>
                  <th className="py-1 font-medium">Caixas</th>
                </tr>
              </thead>
              <tbody>
                {service.usageHistory.map((s, i) => (
                  <tr key={`${s.recordedAt}-${i}`} className="border-b border-line/50 last:border-0">
                    <td className="py-1.5 pr-3 text-muted">{fmtDateTime(s.recordedAt)}</td>
                    <td className="py-1.5 pr-3">
                      {s.storageUsedGb} / {s.storageLimitGb} GB
                    </td>
                    <td className="py-1.5">
                      {s.mailboxesUsed} / {s.mailboxesLimit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RenewPanel({
  serviceId,
  planName,
  domain,
  onNotice,
}: {
  serviceId: string;
  planName: string;
  domain: string;
  onNotice: (msg: string) => void;
}) {
  const [months, setMonths] = useState(12);
  const [method, setMethod] = useState(PAYMENT_METHODS[0]?.id ?? "mpesa");
  const [reference, setReference] = useState(generateReference);
  const [quote, setQuote] = useState<{ planName?: string; months?: number; pricePerMonth?: number; subtotal?: number; total?: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = useCallback(
    async (m: number) => {
      setSettling(true);
      setError(null);
      try {
        const res = await fetch(`/api/email/services/${serviceId}/renew?months=${m}`, { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          planName?: string;
          months?: number;
          pricePerMonth?: number;
          subtotal?: number;
          total?: number;
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Não foi possível calcular o valor da renovação.");
          setQuote(null);
          return;
        }
        setQuote(data);
      } catch {
        setQuote(null);
      } finally {
        setSettling(false);
      }
    },
    [serviceId],
  );

  useEffect(() => {
    const token = window.setTimeout(() => {
      void loadQuote(months);
    }, 0);
    return () => window.clearTimeout(token);
  }, [months, loadQuote]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/email/services/${serviceId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months, method, reference }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; number?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível pedir a renovação.");
        return;
      }
      setReference(generateReference());
      onNotice(
        `Renovação pedida (ordem ${data.number ?? ""}). Complete o pagamento a partir do painel de pagamentos.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display-2 text-lg font-semibold">Renovar serviço</h2>
      <p className="text-sm text-muted">
        Estenda o prazo de <strong>{domain}</strong> ({planName}) por vários meses sem criar um novo serviço.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-muted">Duração (meses)</span>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
            >
              {[1, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? "mês" : "meses"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">Método de pagamento</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">Referência</span>
            <input
              type="text"
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {settling ? (
              <span className="inline-flex items-center gap-1 text-muted">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> A calcular…
              </span>
            ) : quote && quote.total ? (
              <span>
                Total a pagar: <strong className="text-emerald-600">{quote.total} MT</strong>
                {quote.pricePerMonth ? <span className="text-muted"> · {quote.pricePerMonth} MT/mês</span> : null}
              </span>
            ) : (
              <span className="text-muted">Selecione a duração para ver o valor.</span>
            )}
          </div>
          <Link href="/dashboard/payments" className="text-sm text-muted hover:underline">
            Ver pagamentos pendentes →
          </Link>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}

        <button type="submit" disabled={busy || settling || !quote?.total} className="button">
          {busy ? "A pedir…" : "Pedir renovação"}
        </button>
        <p className="text-xs text-muted">
          Após o pedido, será criada uma ordem pendente. Envie o comprovativo no painel de pagamentos; a renovação
          é ativada quando um administrador confirma.
        </p>
      </form>
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

      <QuotaBanner usage={service.usage} domain={service.domain} />

      <RenewPanel
        serviceId={service.id}
        planName={service.planName}
        domain={service.domain}
        onNotice={setNotice}
      />

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
        <Link
          href={`/dashboard/email/${service.id}/dns`}
          className="block rounded-xl border border-line bg-surface p-5 hover:border-emerald-400"
        >
          <div className="text-sm text-muted">DNS · {DNS_STATUS[service.dnsStatus] ?? service.dnsStatus}</div>
          <div className="mt-1 text-sm font-semibold">Assistente de registos</div>
          <div className="mt-1 text-xs text-muted">MX, SPF, DKIM e DMARC →</div>
        </Link>
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
                      className={`h-full rounded-full ${quotaBarClass(Math.min(100, m.quotaPercent || 0))}`}
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
                  {(m.accessedAt || m.passwordChangedAt) && (
                    <div className="mt-2 text-xs text-muted">
                      {m.accessedAt ? `Último acesso ${fmt(m.accessedAt)} · ` : ""}
                      {m.passwordChangedAt ? `password alterada ${fmt(m.passwordChangedAt)}` : ""}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      <UsagePanel service={service} onRefresh={refresh} />

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