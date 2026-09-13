"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, KeyRound, Mail, RefreshCw, Search, ServerCog, Trash2 } from "lucide-react";

import type { Notify } from "./types";
import type { AdminEmailServiceDetail, AdminEmailServiceRow } from "./types";
import { ActionBtn, Empty, IconBtn, Pill, Spinner, card, fmtDate } from "./views";

const STATUS_TONE: Record<string, "ok" | "warn" | "muted" | "brand" | "danger"> = {
  provisioning: "brand",
  active: "ok",
  suspended: "warn",
  error: "danger",
  cancelled: "muted",
};

const STATUS_LABELS: Record<string, string> = {
  provisioning: "a aprovisionar",
  active: "ativo",
  suspended: "suspenso",
  error: "erro",
  cancelled: "cancelado",
};

const DNS_LABELS: Record<string, string> = {
  none: "sem DNS",
  pending: "pendente",
  verifying: "a verificar",
  verified: "verificado",
  failed: "incompleto",
  external: "externo",
};

export function EmailAdminView({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<AdminEmailServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminEmailServiceDetail | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar serviços de email.");
      setRows(json.services ?? []);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar serviços de email.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(() => void loadRows());
  }, [loadRows]);

  const summary = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const provisioning = rows.filter((r) => r.status === "provisioning").length;
    const mailboxes = rows.reduce((sum, r) => sum + r.used.mailboxesUsed, 0);
    const dnsIssues = rows.filter((r) => r.status === "active" && r.dnsStatus !== "verified" && r.dnsStatus !== "external").length;
    const storageGb = Math.round(10 * rows.reduce((sum, r) => sum + r.used.storageUsedGb, 0)) / 10;
    return { total: rows.length, active, provisioning, mailboxes, dnsIssues, storageGb };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.domain.toLowerCase().includes(q) ||
        (r.customerName ?? "").toLowerCase().includes(q) ||
        (r.customerEmail ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function openService(serviceId: string) {
    if (expanded === serviceId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(serviceId);
    setBusyKey(`bundle-${serviceId}`);
    try {
      const res = await fetch(`/api/admin/email?serviceId=${serviceId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar o serviço.");
      setDetail(json.detail as AdminEmailServiceDetail);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar o serviço.");
      setExpanded(null);
    } finally {
      setBusyKey(null);
    }
  }

  async function post(serviceId: string, action: string, body: Record<string, unknown>, okText: string) {
    setBusyKey(`${action}-${serviceId}`);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, action, ...body }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro na operação.");
      notify("ok", okText);
      await loadRows();
      if (detail?.service.id === serviceId) {
        const detailsRes = await fetch(`/api/admin/email?serviceId=${serviceId}`, { cache: "no-store" });
        const detailsJson = await detailsRes.json();
        if (detailsJson.ok) setDetail(detailsJson.detail as AdminEmailServiceDetail);
      }
      return json;
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro na operação.");
      return null;
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className={card}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[10.8px] font-semibold text-paper">Serviços de email</h2>
          <p className="mt-0.5 text-sm text-muted">
            {rows.length ? `${filtered.length} de ${rows.length} serviços de email` : "Serviços criados via checkout e aprovisionados."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar por domínio ou cliente…"
              className="rounded-md border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-sm text-paper outline-none placeholder:text-muted focus:border-brand"
            />
          </div>
          <ActionBtn tone="ghost" busy={loading} onClick={() => void loadRows()}>
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar
          </ActionBtn>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Summary label="Serviços" value={summary.total} />
        <Summary label="Ativos" value={summary.active} tone="ok" />
        <Summary label="Caixas" value={summary.mailboxes} />
        <Summary label="DNS por validar" value={summary.dnsIssues} tone={summary.dnsIssues ? "warn" : "muted"} />
        <Summary label="GB usados" value={`${summary.storageGb} GB`} />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <Empty text={rows.length ? "Nenhum serviço corresponde à pesquisa." : "Ainda não existem serviços de email."} />
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((row, i) => {
            const open = expanded === row.id;
            const st = STATUS_TONE[row.status] ?? "muted";
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
              >
                <div className="flex flex-wrap items-center gap-3 py-3">
                  <IconBtn title={open ? "Fechar detalhe" : "Abrir detalhe"} busy={busyKey === `bundle-${row.id}`} onClick={() => void openService(row.id)}>
                    {open ? <ChevronDown className="h-4 w-4 rotate-180" /> : <ChevronDown className="h-4 w-4" />}
                  </IconBtn>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-brand" />
                      <p className="truncate text-sm font-medium text-paper">{row.domain}</p>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {row.customerName ?? "—"}{row.customerEmail ? ` · ${row.customerEmail}` : ""}
                    </p>
                  </div>

                  <div className="mr-auto flex flex-wrap items-center gap-2">
                    <Pill tone={st}>{STATUS_LABELS[row.status] ?? row.status}</Pill>
                    <Pill tone="brand">{row.planName ?? "Sem plano"}</Pill>
                    <span className="text-xs text-muted">
                      {row.used.mailboxesUsed}/{row.mailboxLimit} caixas · {row.used.storageUsedGb}/{row.storageLimitGb} GB
                    </span>
                    <span className="text-xs text-muted">DNS: {DNS_LABELS[row.dnsStatus] ?? row.dnsStatus}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.status === "active" ? (
                      <ActionBtn tone="ghost" busy={busyKey === `status-${row.id}`} title="Suspender serviço"
                        onClick={() => setConfirmSuspend(row.id)}>
                        Suspender
                      </ActionBtn>
                    ) : row.status === "suspended" ? (
                      <ActionBtn tone="ok" busy={busyKey === `status-${row.id}`} title="Reativar serviço"
                        onClick={() => { if (window.confirm(`Reativar o serviço de ${row.domain}?`)) void post(row.id, "status", { status: "resume" }, "Serviço reativado."); }}>
                        Reativar
                      </ActionBtn>
                    ) : null}
                    <ActionBtn tone="ghost" busy={busyKey === `sync-${row.id}`} title="Voltar a sincronizar o uso"
                      onClick={() => void post(row.id, "sync", {}, "Uso sincronizado.")}>
                      <ServerCog className="h-3.5 w-3.5" /> Sincronizar
                    </ActionBtn>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      {detail && detail.service.id === row.id ? (
                        <div className="grid grid-cols-1 gap-4 pb-4 lg:grid-cols-2">
                          <div className="space-y-4">
                            <div className="rounded-lg border border-line bg-ink p-4">
                              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-paper">
                                <Mail className="h-4 w-4 text-brand" /> Detalhes do serviço
                              </h4>
                              <dl className="space-y-2 text-sm">
                                <Row label="Estado"><Pill tone={st}>{STATUS_LABELS[row.status] ?? row.status}</Pill></Row>
                                <Row label="DNS">{DNS_LABELS[row.dnsStatus] ?? row.dnsStatus}</Row>
                                <Row label="Plano">{detail.service.planName ?? "—"}</Row>
                                <Row label="Cliente">{detail.service.customerName ?? "—"}</Row>
                                <Row label="Email do cliente">{detail.service.customerEmail ?? "—"}</Row>
                                <Row label="Fornecedor">{detail.service.providerMode === "simulated" ? "Simulado" : detail.service.providerId ?? "—"}</Row>
                                <Row label="Criado em">{fmtDate(detail.service.createdAt ?? "")}</Row>
                                <Row label="Renova em">{detail.service.expiresAt ? fmtDate(detail.service.expiresAt) : "—"}</Row>
                              </dl>
                              <div className="mt-3">
                                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Uso</p>
                                <UsageBar
                                  label="Armazenamento"
                                  used={`${detail.service.used.storageUsedGb} GB`}
                                  total={`${detail.service.storageLimitGb} GB`}
                                  percent={pctGb(detail.service.used.storageUsedGb, detail.service.storageLimitGb)}
                                />
                              </div>
                            </div>

                            <div className="rounded-lg border border-line bg-ink p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <h4 className="flex items-center gap-2 text-sm font-medium text-paper">
                                  <KeyRound className="h-4 w-4 text-brand" /> Caixas ({detail.mailboxes.length})
                                </h4>
                              </div>
                              {detail.mailboxes.length === 0 ? (
                                <p className="text-sm text-muted">Sem caixas neste serviço.</p>
                              ) : (
                                <div className="divide-y divide-line">
                                  {detail.mailboxes.map((m) => (
                                    <div key={m.id} className="py-2">
                                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                        <span className="font-medium text-paper">{m.emailAddress}</span>
                                        <Pill tone={mbTone(m.status)}>{m.status === "active" ? "ativa" : m.status}</Pill>
                                      </div>
                                      <div className="mt-1 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                                          <div className="h-full rounded-full bg-ok" style={{ width: `${Math.min(100, m.quotaPercent || 0)}%` }} />
                                        </div>
                                        <span className="text-[11px] text-muted">{m.storageUsedGb}/{m.storageLimitGb} GB</span>
                                      </div>
                                      <p className="mt-1 text-[11px] text-muted">
                                        {m.passwordChangedAt ? `password alterada ${fmtDate(m.passwordChangedAt)}` : "password nunca alterada"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {detail.aliases.length > 0 && (
                                <div className="mt-3 border-t border-line pt-3">
                                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Aliases ({detail.aliases.length})</p>
                                  <div className="space-y-1 text-xs text-paper">
                                    {detail.aliases.slice(0, 8).map((a) => (
                                      <div key={a.id} className="flex justify-between gap-2">
                                        <span>{a.aliasAddress}</span>
                                        <span className="text-muted">→ {a.destination}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-lg border border-line bg-ink p-4">
                              <h4 className="mb-2 text-sm font-medium text-paper">Histórico de uso</h4>
                              {detail.usageHistory.length === 0 ? (
                                <p className="text-sm text-muted">Sem medições ainda.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-sm">
                                    <thead>
                                      <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                                        <th className="py-1 pr-3 font-medium">Data</th>
                                        <th className="py-1 pr-3 font-medium">Armazenamento</th>
                                        <th className="py-1 font-medium">Caixas</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.usageHistory.map((s, ii) => (
                                        <tr key={ii} className="border-b border-line/50 last:border-0">
                                          <td className="py-1.5 pr-3 text-xs text-muted">{fmtDate(s.recordedAt ?? "")}</td>
                                          <td className="py-1.5 pr-3 text-xs">{s.storageUsedGb} / {s.storageLimitGb} GB</td>
                                          <td className="py-1.5 text-xs">{s.mailboxesUsed} / {s.mailboxesLimit}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div className="rounded-lg border border-line bg-ink p-4">
                              <h4 className="mb-2 text-sm font-medium text-paper">Atividade recente</h4>
                              {detail.activity.length === 0 ? (
                                <p className="text-sm text-muted">Sem atividade registada.</p>
                              ) : (
                                <div className="divide-y divide-line">
                                  {detail.activity.slice(0, 8).map((a, ii) => (
                                    <div key={ii} className="flex items-center justify-between gap-2 py-1.5">
                                      <p className="truncate text-xs text-paper">{a.action}</p>
                                      <span className="shrink-0 text-[11px] text-muted">{fmtDate(a.createdAt)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center py-6"><Spinner /></div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {confirmSuspend && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-content-center bg-black/60 p-4"
            onClick={() => setConfirmSuspend(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="w-full max-w-sm rounded-xl border border-line bg-surface p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-brand" />
                <h3 className="text-sm font-semibold text-paper">Suspender serviço</h3>
              </div>
              <p className="text-sm text-muted">Vais suspender o serviço de email de {rows.find((r) => r.id === confirmSuspend)?.domain ?? confirmSuspend}. As caixas deixam de aceitar ligações até reativação.</p>
              <div className="mt-5 flex justify-end gap-2">
                <ActionBtn tone="ghost" onClick={() => setConfirmSuspend(null)}>Cancelar</ActionBtn>
                <ActionBtn tone="danger" busy={busyKey === `status-${confirmSuspend}`} onClick={() => {
                  const id = confirmSuspend;
                  setConfirmSuspend(null);
                  void post(id, "status", { status: "suspend", reason: "Suspensão administrativa" }, "Serviço suspenso.");
                }}>
                  Suspender
                </ActionBtn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "muted" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-brand" : "text-paper";
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-paper">{children}</dd>
    </div>
  );
}

function UsageBar({ label, used, total, percent }: { label: string; used: string; total: string; percent: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-paper">{used} · {total}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${percent >= 90 ? "bg-brand" : "bg-ok"}`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function pctGb(usedGb: number, limitGb: number) {
  if (!limitGb) return 0;
  return Math.round((usedGb / limitGb) * 100);
}

function mbTone(status: string): "ok" | "warn" | "muted" | "brand" {
  if (status === "active") return "ok";
  if (status === "suspended") return "warn";
  if (status === "provisioning") return "brand";
  return "muted";
}