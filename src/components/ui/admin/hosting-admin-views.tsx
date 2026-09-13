"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, PackageCheck, RefreshCw, Search, Server, Trash2 } from "lucide-react";

import type { Notify } from "./types";
import { ActionBtn, Empty, IconBtn, Pill, Spinner, card, fmtDate } from "./views";

type AdminAccountRow = {
  id: string;
  domain: string | null;
  username: string | null;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  planName: string | null;
  planId: string | null;
  quotaGb: number;
  provider: string;
  renewsAt: string | null;
  createdAt: string;
  usage: { storage_mb: number; bandwidth_mb: number } | null;
  counts: { websites: number; databases: number; backups: number; alerts: number };
};

type AdminPlan = { id: string; name: string };

type AccountDetail = {
  ok?: boolean;
  account: {
    id: string;
    domain: string | null;
    username: string | null;
    status: string;
    planId: string | null;
    quotaGb: number;
    renewsAt: string | null;
    createdAt: string;
  };
  plan: AdminPlan | null;
  provider: { id: string; label: string };
  usage: { storage_mb: number; bandwidth_mb: number } | null;
  counts: { websites: number; databases: number; backups: number; ssl: number; alerts: number; cron: number };
  activity: Array<{ action: string; actorEmail: string | null; createdAt: string }>;
};

const STATUS_TONE: Record<string, "ok" | "warn" | "muted" | "brand"> = {
  active: "ok",
  suspended: "warn",
  terminated: "muted",
  pending: "brand",
};

const STATUS_LABELS: Record<string, string> = {
  active: "ativo",
  suspended: "suspenso",
  terminated: "terminado",
  pending: "pendente",
};

export function AdminHostingAccountsView({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<AdminAccountRow[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [terminateConfirm, setTerminateConfirm] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/hosting-accounts", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar contas de alojamento.");
      setRows(json.accounts ?? []);
      setPlans(json.plans ?? []);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar contas de alojamento.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(() => void loadRows());
  }, [loadRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        (a.domain ?? "").toLowerCase().includes(q) ||
        (a.customerName ?? "").toLowerCase().includes(q) ||
        (a.customerEmail ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function openAccount(hostingId: string) {
    if (expanded === hostingId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(hostingId);
    setBusyKey(`bundle-${hostingId}`);
    try {
      const res = await fetch(`/api/admin/hosting-accounts?hostingId=${hostingId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar a conta.");
      setDetail(json as AccountDetail);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar a conta.");
      setExpanded(null);
    } finally {
      setBusyKey(null);
    }
  }

  async function post(hostingId: string, action: string, body: Record<string, unknown>, okText: string) {
    setBusyKey(`${action}-${hostingId}`);
    try {
      const res = await fetch("/api/admin/hosting-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, hostingId, ...body }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro.");
      notify("ok", okText);
      await loadRows();
      if (detail?.account.id === hostingId) {
        const detailRes = await fetch(`/api/admin/hosting-accounts?hostingId=${hostingId}`, { cache: "no-store" });
        const detailJson = await detailRes.json();
        if (detailJson.ok) setDetail(detailJson as AccountDetail);
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
          <h2 className="text-[10.8px] font-semibold text-paper">Contas de alojamento</h2>
          <p className="mt-0.5 text-sm text-muted">
            {rows.length
              ? `${filtered.length} de ${rows.length} contas · provider: ${rows[0]?.provider ?? "—"}`
              : "Contas criadas via subscrições e ativadas pelo fluxo de alojamento."}
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

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <Empty text={rows.length ? "Nenhuma conta corresponde à pesquisa." : "Ainda não existem contas de alojamento."} />
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((row, i) => {
            const open = expanded === row.id;
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
              >
                <div className="flex flex-wrap items-center gap-3 py-3">
                  <IconBtn title={open ? "Fechar detalhe" : "Abrir detalhe"} busy={busyKey === `bundle-${row.id}`} onClick={() => void openAccount(row.id)}>
                    {open ? <ChevronDown className="h-4 w-4 rotate-180" /> : <ChevronDown className="h-4 w-4" />}
                  </IconBtn>
                  <div className="flex w-56 min-w-0 flex-1">
                    <div className="min-w-0 flex-none">
                      <p className="truncate text-sm font-medium text-paper">{row.domain ?? "Sem domínio"}</p>
                      <p className="truncate text-xs text-muted">
                        {row.customerName ?? "—"}{row.customerEmail ? ` · ${row.customerEmail}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mr-auto flex flex-wrap items-center gap-2">
                    <Pill tone={STATUS_TONE[row.status] ?? "muted"}>{STATUS_LABELS[row.status] ?? row.status}</Pill>
                    <Pill tone="brand">{row.planName ?? "Sem plano"}</Pill>
                    {row.usage ? (
                      <span className="text-xs text-muted">{pct(row.usage.storage_mb, row.quotaGb)}% disco</span>
                    ) : null}
                    <span className="text-xs text-muted">
                      {row.counts.websites} sites · {row.counts.databases} BD · {row.counts.backups} backups
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="sr-only" htmlFor={`plan-${row.id}`}>Plano de {row.domain ?? row.id}</label>
                    <select
                      id={`plan-${row.id}`}
                      value={row.planId ?? ""}
                      disabled={busyKey === `plan-${row.id}`}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        if (!window.confirm("Mudar o plano desta conta? O uso é reavaliado e o estado pode mudar.")) {
                          void loadRows();
                          return;
                        }
                        void post(row.id, "plan", { planId: e.target.value }, "Plano atualizado.");
                      }}
                      className="max-w-36 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-paper disabled:opacity-50"
                    >
                      <option value="">{row.planName ?? "—"}</option>
                      {plans
                        .filter((p) => p.id !== row.planId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {row.status === "active" ? (
                      <ActionBtn tone="ghost" busy={busyKey === `status-${row.id}`} title="Suspender conta"
                        onClick={() => { if (window.confirm(`Suspender a conta de ${row.domain ?? row.id}?`)) void post(row.id, "status", { status: "suspended", reason: "Suspensão administrativa" }, "Conta suspensa."); }}>
                        Suspender
                      </ActionBtn>
                    ) : row.status === "suspended" ? (
                      <ActionBtn tone="ok" busy={busyKey === `status-${row.id}`} title="Reativar conta"
                        onClick={() => { if (window.confirm(`Reativar a conta de ${row.domain ?? row.id}?`)) void post(row.id, "status", { status: "active" }, "Conta reativada."); }}>
                        Reativar
                      </ActionBtn>
                    ) : null}
                    <ActionBtn tone="ghost" busy={busyKey === `sync-${row.id}`} title="Voltar a calcular o uso real"
                      onClick={() => void post(row.id, "sync", {}, "Uso sincronizado.")}>
                      <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
                    </ActionBtn>
                    <ActionBtn tone="ghost" busy={busyKey === `provision-${row.id}`} title="Voltar a enfileirar o aprovisionamento"
                      onClick={() => void post(row.id, "provision", {}, "Aprovisionamento reenfileirado.")}>
                      <PackageCheck className="h-3.5 w-3.5" />
                    </ActionBtn>
                    {row.status === "terminated" ? (
                      <IconBtn busy={busyKey === `status-${row.id}`} title="Reativar conta"
                        onClick={() => void post(row.id, "status", { status: "active" }, "Conta reativada.")}>
                        <RefreshCw className="h-4 w-4" />
                      </IconBtn>
                    ) : (
                      <IconBtn busy={busyKey === `status-${row.id}`} title="Terminar conta" onClick={() => setTerminateConfirm(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    )}
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
                      {detail && detail.account.id === row.id ? (
                        <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2">
                          <div className="space-y-4 rounded-lg border border-line bg-ink p-4">
                            <h4 className="flex items-center gap-2 text-sm font-medium text-paper">
                              <Server className="h-4 w-4 text-brand" /> Detalhes da conta
                            </h4>
                            <dl className="space-y-2 text-sm">
                              <Row label="Estado"><Pill tone={STATUS_TONE[row.status] ?? "muted"}>{STATUS_LABELS[row.status] ?? row.status}</Pill></Row>
                              <Row label="Utilizador">{row.username ?? "—"}</Row>
                              <Row label="Plano">{detail.plan?.name ?? "—"}</Row>
                              <Row label="Provider">{detail.provider.label}</Row>
                              <Row label="Criada em">{fmtDate(row.createdAt)}</Row>
                              <Row label="Renova em">{row.renewsAt ? fmtDate(row.renewsAt) : "—"}</Row>
                              <Row label="Cota de disco">{row.quotaGb ? `${row.quotaGb} GB` : "—"}</Row>
                            </dl>
                            {detail.usage ? (
                              <div>
                                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Uso real</p>
                                <UsageBar label="Disco" used={mb(detail.usage.storage_mb)} total={row.quotaGb ? `${row.quotaGb} GB` : "—"} percent={pct(detail.usage.storage_mb, row.quotaGb)} />
                                <UsageBar label="Tráfego" used={mb(detail.usage.bandwidth_mb)} total="—" percent={0} />
                              </div>
                            ) : (
                              <p className="text-sm text-muted">Ainda sem medições de uso.</p>
                            )}
                            {row.status === "active" ? null : (
                              <p className="text-xs text-muted">Provedor {detail.provider.id === "simulated" ? "simulado" : detail.provider.id} sem painel para reativar contas suspensas — esta ação é apenas administrativa.</p>
                            )}
                          </div>

                          <div className="space-y-4 rounded-lg border border-line bg-ink p-4">
                            <h4 className="text-sm font-medium text-paper">Recursos ({detail.counts.websites + detail.counts.databases + detail.counts.backups + detail.counts.ssl + detail.counts.cron} registados)</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <Info label="Websites" value={detail.counts.websites} />
                              <Info label="Bases de dados" value={detail.counts.databases} />
                              <Info label="Backups" value={detail.counts.backups} />
                              <Info label="Certificados SSL" value={detail.counts.ssl} />
                              <Info label="Tarefas cron" value={detail.counts.cron} />
                              <Info label="Alertas abertos" value={detail.counts.alerts} />
                            </div>
                            <p className="mb-1 mt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Atividade recente</p>
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
        {terminateConfirm && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-content-center bg-black/60 p-4"
            onClick={() => setTerminateConfirm(null)}
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
                <h3 className="text-sm font-semibold text-paper">Terminar conta</h3>
              </div>
              <p className="text-sm text-muted">Vais terminar a conta de {rows.find((r) => r.id === terminateConfirm)?.domain ?? terminateConfirm}. Os dados permanecem na base de dados, mas a conta deixa de estar ativa.</p>
              <div className="mt-5 flex justify-end gap-2">
                <ActionBtn tone="ghost" onClick={() => setTerminateConfirm(null)}>Cancelar</ActionBtn>
                <ActionBtn tone="danger" busy={busyKey === `status-${terminateConfirm}`} onClick={() => {
                  const id = terminateConfirm;
                  setTerminateConfirm(null);
                  void post(id, "status", { status: "terminated", reason: "Termino administrativo" }, "Conta terminada.");
                }}>
                  Terminar
                </ActionBtn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-paper">{children}</dd>
    </div>
  );
}

function Info({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-medium text-paper">{value}</p>
    </div>
  );
}

function UsageBar({ label, used, total, percent }: { label: string; used: string; total: string; percent: number }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-paper">{used} {total ? `· ${total}` : ""}</span>
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

function pct(storageMb: number, quotaGb: number) {
  if (!quotaGb) return 0;
  return Math.round((storageMb / (quotaGb * 1024)) * 100);
}

function mb(mbValue: number) {
  if (mbValue >= 1024) return `${(mbValue / 1024).toFixed(1)} GB`;
  return `${mbValue} MB`;
}