"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientEmailDnsBundle, ClientEmailDnsRecord } from "@/lib/client-data";

const TYPE_LABELS: Record<string, string> = {
  mx: "MX",
  spf: "SPF",
  dkim: "DKIM",
  dmarc: "DMARC",
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pendente", tone: "text-amber-600" },
  verified: { label: "Verificado", tone: "text-emerald-600" },
  failed: { label: "Faltando", tone: "text-red-600" },
  configured: { label: "Configurado", tone: "text-emerald-600" },
  external: { label: "Externo", tone: "text-muted" },
};

const DNS_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  none: { label: "Sem registos", tone: "text-muted" },
  pending: { label: "Registos pendentes", tone: "text-amber-600" },
  verifying: { label: "Verificação em curso", tone: "text-amber-600" },
  verified: { label: "Registos verificados", tone: "text-emerald-600" },
  failed: { label: "Registos incompletos", tone: "text-red-600" },
  external: { label: "DNS externo", tone: "text-muted" },
};

export function EmailDnsView({ initial }: { initial: ClientEmailDnsBundle }) {
  const [bundle, setBundle] = useState(initial);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const domain = bundle.service.domain;

  const verify = async () => {
    setError(null);
    setNotice(null);
    setVerifying(true);
    try {
      const res = await fetch(`/api/email/services/${bundle.service.id}/dns/verify`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string; service?: ClientEmailDnsBundle["service"]; records?: ClientEmailDnsRecord[] };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível verificar os registos.");
        return;
      }
      if (data.service) setBundle((b) => ({ ...b, service: data.service as ClientEmailDnsBundle["service"] }));
      if (data.records) setBundle((b) => ({ ...b, records: data.records ?? [] }));
      const missing = (data.records ?? []).filter((r) => r.status === "failed").length;
      setNotice(
        missing === 0
          ? "Todos os registos foram encontrados no DNS público."
          : `Ainda faltam ${missing} registo(s). Verifique os valores e aguarde a propagação.`,
      );
    } catch {
      setError("Falha na verificação. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Não foi possível copiar. Copie manualmente.");
    }
  };

  const st = DNS_STATUS_LABELS[bundle.service.dnsStatus] ?? { label: bundle.service.dnsStatus, tone: "" };
  const host = (name: string) => {
    if (name === "@" || name === "*") return domain;
    if (name.toLowerCase().endsWith(`.${domain.toLowerCase()}`)) return name;
    return `${name}.${domain}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/dashboard/email/${bundle.service.id}`} className="text-sm text-muted hover:underline">
            ← Voltar ao serviço
          </Link>
          <h1 className="mt-1 font-display-2 text-2xl font-semibold tracking-tight">Assistente DNS · {domain}</h1>
          <p className="text-muted">
            Registos MX, SPF, DKIM e DMARC para o seu email profissional.
          </p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${st.tone}`}>{st.label}</div>
          <button
            type="button"
            onClick={verify}
            disabled={verifying}
            className="button mt-2"
          >
            {verifying ? "A verificar…" : "Verificar registos agora"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      <div className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
        <h2 className="mb-1 font-display-2 text-base font-semibold text-text">Como configurar</h2>
        <ol className="ml-4 list-decimal space-y-1">
          <li>Adicione os registos abaixo no DNS do seu domínio (painel de registo, cPanel ou arquivo de zona).</li>
          <li>Se o domínio está registado noutro sítio, adicione-os no painel do seu registar ou alojamento.</li>
          <li>Após adicionar, clique em “Verificar registos agora”. A propagação pode demorar de minutos a 48 horas.</li>
        </ol>
        <p className="mt-2 text-xs">
          Nota: a chave DKIM aqui apresentada é ilustrativa. Quando o envio de email em produção for ativado, a chave pública
          final será fornecida pelo servidor de email.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="font-display-2 text-lg font-semibold">Registos recomendados</h2>
        {!bundle.records.length ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
            Ainda não há registos recomendados para este serviço. Tente novamente daqui a instantes.
          </div>
        ) : (
          bundle.records.map((r) => {
            const label = TYPE_LABELS[r.recordType] ?? r.recordType.toUpperCase();
            const rs = STATUS_LABELS[r.status] ?? { label: r.status, tone: "" };
            return (
              <div key={r.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs font-semibold">{label}</span>
                    <span className={`text-sm font-medium ${rs.tone}`}>{rs.label}</span>
                    {r.lastCheckedAt && (
                      <span className="text-xs text-muted">
                        Verificado {new Date(r.lastCheckedAt).toLocaleString("pt-PT")}
                      </span>
                    )}
                  </div>
                  {r.value && (
                    <button
                      type="button"
                      onClick={() => copy(r.id, r.value!.value)}
                      className="outline-button px-3 py-1 text-xs"
                    >
                      {copiedId === r.id ? "Copiado" : "Copiar valor"}
                    </button>
                  )}
                </div>

                {r.value && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr]">
                    <div className="space-y-1 text-sm">
                      <div className="text-xs text-muted">Tipo</div>
                      <div className="font-mono text-sm">{r.value.type}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="text-xs text-muted">Nome / Host</div>
                      <div className="font-mono text-sm">{host(r.value.name)}</div>
                    </div>
                    <div className="space-y-1 text-sm sm:col-span-2">
                      <div className="text-xs text-muted">Valor{r.value.priority != null ? " (Prioridade)" : ""}</div>
                      <div className="break-all font-mono text-sm">
                        {r.value.value}
                        {r.value.priority != null ? ` · ${r.value.priority}` : ""}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}