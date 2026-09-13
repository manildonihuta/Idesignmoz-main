"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  KeyRound,
  Mail,
  Network,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Shield,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";

import type { Notify } from "./types";
import { ActionBtn, Empty, IconBtn, Pill, SectionHead, Spinner, card, fmtDate } from "./views";

/* ------------------------------------------------------------------ *
 * Client-side shapes (mirror of src/services/infra.service.ts views)
 * ------------------------------------------------------------------ */

type HealthRow = {
  provider_id: string;
  status: string;
  response_time_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  checked_at: string;
};

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  adapter: string | null;
  status: string;
  statusLabel: string;
  environment: string;
  capabilities: string[];
  configured: boolean;
  apiEndpoint: string | null;
  isBuiltin: boolean;
  lastHealthAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  health: HealthRow | null;
};

type CredentialRow = {
  id: string;
  providerSlug?: string;
  field: string;
  masked: string;
  status: string;
  expiresAt: string | null;
  rotatedAt: string | null;
  lastVerifiedAt: string | null;
  lastVerifiedOk: boolean | null;
  createdAt: string;
  expiring?: boolean;
};

type SyncRow = {
  id: string;
  providerId: string | null;
  providerSlug?: string;
  service: string;
  kind: string;
  status: string;
  recordsProcessed: number;
  lastError: string | null;
  retryCount: number;
  maxRetries: number;
  runAfter: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

type WebhookRow = {
  id: string;
  providerId: string | null;
  providerSlug?: string;
  service: string;
  name: string;
  url: string;
  status: string;
  events: string[];
  lastDeliveredAt: string | null;
  lastStatus: string | null;
  createdAt: string;
};

type ActivityRow = {
  id: string;
  providerId: string | null;
  providerSlug?: string;
  event: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
};

type EventRow = {
  id: string;
  provider_id: string | null;
  source: string;
  event: string;
  payload: unknown;
  idempotency_key: string;
  signature_verified: boolean;
  status: string;
  error: string | null;
  retry_count: number;
  created_at: string;
};

type Detail = ProviderRow & {
  resourcesByService: Array<{ service: string; count: number }>;
  credentials: CredentialRow[];
  syncs: SyncRow[];
  webhooks: WebhookRow[];
  activity: ActivityRow[];
  healthHistory: HealthRow[];
};

type Overview = {
  totalProviders: number;
  activeProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unavailableProviders: number;
  pendingSyncs: number;
  failedSyncs24h: number;
  providerErrors24h: number;
  avgResponseTimeMs: number | null;
  expiringCredentials: number;
};

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  hosting: Server,
  dns: Network,
  domain: GlobeIcon,
  email: Mail,
  ssl: Shield,
  cdn: Zap,
  backup: Database,
  storage: Database,
};

function GlobeIcon({ className }: { className?: string }) {
  return <Network className={className} />;
}

const STATUS_TONE: Record<string, "ok" | "warn" | "muted" | "brand" | "danger"> = {
  active: "ok",
  healthy: "ok",
  degraded: "warn",
  maintenance: "warn",
  unavailable: "danger",
  error: "danger",
  failed: "danger",
  rejected: "danger",
  unknown: "muted",
  inactive: "muted",
  revoked: "muted",
  expired: "muted",
  pending: "brand",
  running: "brand",
  queued: "brand",
  processing: "brand",
  completed: "ok",
  succeeded: "ok",
  cancelled: "muted",
  processed: "ok",
  ignored: "muted",
};

const SERVICE_LABEL: Record<string, string> = {
  hosting: "Alojamento",
  dns: "DNS",
  domain: "Domínios",
  email: "Email",
  ssl: "SSL",
  cdn: "CDN",
  backup: "Backups",
  storage: "Armazenamento",
};

const KIND_LABEL: Record<string, string> = {
  manual: "manual",
  scheduled: "agendado",
  event: "evento",
  full: "completo",
  incremental: "incremental",
};

const EVENTS_OPTIONS = [
  "hosting.account.created",
  "hosting.account.suspended",
  "hosting.account.terminated",
  "domain.registered",
  "domain.expiring",
  "dns.zone.changed",
  "ssl.certificate.issued",
  "backup.completed",
];

function toneFor(status: string): "ok" | "warn" | "muted" | "brand" | "danger" {
  return STATUS_TONE[status] ?? "muted";
}

/** Marks credentials that expire within 14 days (computed outside render). */
function markExpiring(credential: CredentialRow): CredentialRow {
  if (!credential.expiresAt) return credential;
  const expiring = new Date(credential.expiresAt).getTime() - Date.now() < 86400000 * 14;
  return expiring ? { ...credential, expiring: true } : credential;
}

function dateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT");
}

function Ctx({ children, title, desc, right }: { children: React.ReactNode; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <section className={card}>
      <SectionHead title={title} desc={desc} right={right} />
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-paper outline-none transition-colors focus:border-brand";

/* ------------------------------------------------------------------ *
 * InfrastructureView — tab host
 * ------------------------------------------------------------------ */

type TabId = "overview" | "providers" | "health" | "credentials" | "syncs" | "webhooks" | "activity";

const TABS: Array<{ id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Visão geral", Icon: PackageCheck },
  { id: "providers", label: "Fornecedores", Icon: Server },
  { id: "health", label: "Saúde", Icon: Activity },
  { id: "credentials", label: "Credenciais", Icon: KeyRound },
  { id: "syncs", label: "Sincronização", Icon: RefreshCw },
  { id: "webhooks", label: "Webhooks", Icon: Webhook },
  { id: "activity", label: "Atividade", Icon: Activity },
];

export function InfrastructureView({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="space-y-4">
      <SectionHead
        title="Infraestrutura"
        desc="Fornecedores, credenciais encriptadas, saúde, sincronização e webhooks."
        right={
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.id ? "bg-brand text-white" : "border border-line bg-surface-2 text-muted hover:text-paper"
                }`}
              >
                <t.Icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "overview" && <OverviewTab notify={notify} />}
          {tab === "providers" && <ProvidersTab notify={notify} />}
          {tab === "health" && <HealthTab notify={notify} />}
          {tab === "credentials" && <CredentialsTab notify={notify} />}
          {tab === "syncs" && <SyncsTab notify={notify} />}
          {tab === "webhooks" && <WebhooksTab notify={notify} />}
          {tab === "activity" && <ActivityTab notify={notify} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Overview
 * ------------------------------------------------------------------ */

function OverviewTab({ notify }: { notify: Notify }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/infra", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar a visão geral.");
      setOverview(json.overview as Overview);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar a visão geral.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(() => void load());
  }, [load]);

  async function runAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/infra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "health_runall" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Não foi possível executar as verificações.");
      notify("ok", `Verificações concluídas · ${json.checked} verificados · ${json.degraded} degradados · ${json.unavailable} indisponíveis.`);
      await load();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Não foi possível executar as verificações.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className={`${card} flex items-center justify-center py-16`}>
        <Spinner />
      </div>
    );
  }
  if (!overview) return <Empty text="Sem dados" />;

  const metric = (label: string, value: string | number, tone: "ok" | "warn" | "danger" | "muted" = "muted") => (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-brand" : tone === "danger" ? "text-brand" : "text-paper"}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {metric("Fornecedores", overview.totalProviders)}
        {metric("Ativos", overview.activeProviders, "ok")}
        {metric("Saudáveis", overview.healthyProviders, "ok")}
        {metric("Degradados", overview.degradedProviders, overview.degradedProviders > 0 ? "warn" : "muted")}
        {metric("Indisponíveis", overview.unavailableProviders, overview.unavailableProviders > 0 ? "danger" : "muted")}
        {metric("Sincronizações em espera", overview.pendingSyncs, overview.pendingSyncs > 0 ? "warn" : "muted")}
        {metric("Falhas sinc. 24h", overview.failedSyncs24h, overview.failedSyncs24h > 0 ? "danger" : "muted")}
        {metric("Erros 24h", overview.providerErrors24h, overview.providerErrors24h > 0 ? "danger" : "muted")}
        {metric("Credenciais a expirar", overview.expiringCredentials, overview.expiringCredentials > 0 ? "warn" : "muted")}
        {metric("Resposta média", overview.avgResponseTimeMs == null ? "—" : `${overview.avgResponseTimeMs} ms`)}
      </div>

      <div className="flex items-center justify-end">
        <ActionBtn onClick={() => void runAll()} busy={busy} tone="brand" title="Correr verificações de saúde em todos os fornecedores">
          <Activity className="h-3.5 w-3.5" /> Verificar saúde de tudo
        </ActionBtn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Providers
 * ------------------------------------------------------------------ */

function ProvidersTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/infra?view=providers", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao listar os fornecedores.");
      setRows(json.providers as ProviderRow[]);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao listar os fornecedores.");
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
    return rows.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || p.categoryLabel.toLowerCase().includes(q));
  }, [rows, search]);

  async function openProvider(slug: string) {
    if (selectedSlug === slug) {
      setSelectedSlug(null);
      setDetail(null);
      return;
    }
    setSelectedSlug(slug);
    setBusyKey(`p:${slug}`);
    try {
      const res = await fetch(`/api/admin/infra?view=provider&slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar o fornecedor.");
      const loaded = json.detail as Detail;
      setDetail({ ...loaded, credentials: loaded.credentials.map(markExpiring) });
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar o fornecedor.");
      setSelectedSlug(null);
    } finally {
      setBusyKey(null);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className={`${card} flex items-center justify-center py-16`}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {detail ? (
        <ProviderDetailCard detail={detail} notify={notify} onBack={() => { setDetail(null); setSelectedSlug(null); }} onChanged={async () => {
          const res = await fetch(`/api/admin/infra?view=provider&slug=${encodeURIComponent(detail.slug)}`, { cache: "no-store" });
          const json = await res.json();
          if (json.ok) {
            const reloaded = json.detail as Detail;
            setDetail({ ...reloaded, credentials: reloaded.credentials.map(markExpiring) });
            await loadRows();
          }
        }} setBusyKey={setBusyKey} busyKey={busyKey} />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar fornecedores…"
                className={`${inputCls} pl-8`}
              />
            </div>
            <ActionBtn onClick={() => void loadRows()} title="Atualizar lista">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </ActionBtn>
          </div>

          {filtered.length === 0 ? (
            <Empty text="Sem fornecedores" />
          ) : (
            <Ctx title={`Fornecedores · ${filtered.length}`} desc="Adaptadores registados e respetivo estado.">
              <div className="space-y-2">
                {filtered.map((p) => {
                  const Icon = CATEGORY_ICON[p.category] ?? Server;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void openProvider(p.slug)}
                      className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-brand"
                    >
                      <div className="grid size-9 shrink-0 place-content-center rounded-md bg-surface text-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-paper">{p.name}</span>
                          {!p.configured && <Pill tone="warn">não configurado</Pill>}
                        </div>
                        <div className="text-xs text-muted">
                          {p.slug} · {p.categoryLabel} · {p.adapter ?? "sem adaptador"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.health ? (
                          <Pill tone={toneFor(p.health.status)}>{p.health.status}</Pill>
                        ) : (
                          <Pill tone="muted">sem verificação</Pill>
                        )}
                        <Pill tone={toneFor(p.status)}>{p.statusLabel}</Pill>
                        {busyKey === `p:${p.slug}` ? <Spinner /> : <ChevronDown className="h-4 w-4 text-muted" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Ctx>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Provider detail
 * ------------------------------------------------------------------ */

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "active", label: "Ativo" },
  { value: "degraded", label: "Degradado" },
  { value: "maintenance", label: "Manutenção" },
  { value: "inactive", label: "Inativo" },
];

function ProviderDetailCard({
  detail,
  notify,
  onBack,
  onChanged,
  setBusyKey,
  busyKey,
}: {
  detail: Detail;
  notify: Notify;
  onBack: () => void;
  onChanged: () => void;
  setBusyKey: (k: string | null) => void;
  busyKey: string | null;
}) {
  const [editName, setEditName] = useState(detail.name);
  const [editEndpoint, setEditEndpoint] = useState(detail.apiEndpoint ?? "");
  const [editEnv, setEditEnv] = useState(detail.environment);
  const [status, setStatus] = useState(detail.status);
  const [prevStatus, setPrevStatus] = useState(detail.status);

  if (detail.status !== prevStatus) {
    setPrevStatus(detail.status);
    setStatus(detail.status);
  }

  async function post(action: string, payload: Record<string, unknown> = {}) {
    setBusyKey(action);
    try {
      const res = await fetch("/api/admin/infra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ação falhou.");
      notify("ok", json.message ?? "Ação concluída.");
      await onChanged();
      return json;
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Ação falhou.");
      return null;
    } finally {
      setBusyKey(null);
    }
  }

  const saveProvider = async () => {
    setBusyKey("save");
    try {
      const res = await fetch("/api/admin/infra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provider_save", id: detail.id, name: editName, apiEndpoint: editEndpoint.trim() || null, environment: editEnv }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Não foi possível guardar o fornecedor.");
      notify("ok", "Fornecedor atualizado.");
      await onChanged();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Não foi possível guardar o fornecedor.");
    } finally {
      setBusyKey(null);
    }
  };

  const changeStatus = async (value: string) => {
    setStatus(value);
    const json = await post("provider_status", { id: detail.id, status: value });
    if (!json) setStatus(detail.status);
  };

  const runSync = (service: string) => post("sync_run", { providerId: detail.id, service });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-paper">
          <ArrowLeft className="h-4 w-4" /> Todos os fornecedores
        </button>
        <div className="flex items-center gap-2">
          <ActionBtn onClick={() => void post("provider_test", { id: detail.id })} busy={busyKey === "provider_test"} title="Testar ligação ao fornecedor">
            <Send className="h-3.5 w-3.5" /> Testar ligação
          </ActionBtn>
          <ActionBtn onClick={() => void runSync("hosting")} busy={busyKey === "sync_run"} tone="brand" title="Correr uma sincronização manual">
            <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
          </ActionBtn>
        </div>
      </div>

      <div className="space-y-4">
        <Ctx
          title={detail.name}
          desc={detail.slug}
          right={
            <div className="flex items-center gap-2">
              <Pill
                tone={detail.health ? toneFor(detail.health.status) : "muted"}
              >
                {detail.health ? detail.health.status : "sem verificação"}
              </Pill>
              <select
                value={status}
                onChange={(e) => void changeStatus(e.target.value)}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-paper"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ambiente">
              <select value={editEnv} onChange={(e) => setEditEnv(e.target.value)} className={inputCls}>
                <option value="production">produção</option>
                <option value="staging">staging</option>
                <option value="development">desenvolvimento</option>
              </select>
            </Field>
            <Field label="API endpoint (URL)">
              <input value={editEndpoint} onChange={(e) => setEditEndpoint(e.target.value)} className={inputCls} placeholder="https://…" />
            </Field>
            <div className="flex items-end">
              <ActionBtn onClick={() => void saveProvider()} busy={busyKey === "save"} tone="ok" title="Guardar alterações">
                <Check className="h-3.5 w-3.5" /> Guardar
              </ActionBtn>
            </div>
          </div>
          <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Adaptador: {detail.adapter ?? "—"} · Criado: {fmtDate(detail.createdAt)} · Último sync: {dateTime(detail.lastSyncAt)} · Última verificação:{" "}
            {detail.lastHealthAt ? dateTime(detail.lastHealthAt) : "—"}
          </div>
        </Ctx>

        {detail.capabilities.length > 0 && (
          <Ctx title="Capacidades" desc="Funcionalidades suportadas por este fornecedor.">
            <div className="flex flex-wrap gap-1.5">
              {detail.capabilities.map((c) => (
                <Pill key={c} tone="brand">
                  {c}
                </Pill>
              ))}
            </div>
          </Ctx>
        )}

        {detail.resourcesByService.length > 0 && (
          <Ctx title="Recursos mapeados" desc="Objetos internos associados a este fornecedor.">
            <div className="flex flex-wrap gap-3">
              {detail.resourcesByService.map((r) => (
                <div key={r.service} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <div className="font-semibold text-paper">{SERVICE_LABEL[r.service] ?? r.service}</div>
                  <div className="text-muted">{r.count} recurso(s)</div>
                </div>
              ))}
            </div>
          </Ctx>
        )}

        <Ctx
          title={`Credenciais · ${detail.credentials.length}`}
          desc="Guardadas encriptadas; nunca são apresentadas em texto limpo."
          right={<ActionBtn onClick={() => void post("credential_expiry_check")} busy={busyKey === "credential_expiry_check"} title="Verificar credenciais a expirar">Verificar expirações</ActionBtn>}
        >
          {detail.credentials.length === 0 ? (
            <Empty text="Sem credenciais" />
          ) : (
            <div className="space-y-2">
              {detail.credentials.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <KeyRound className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-paper">{c.field}</div>
                    <div className="font-mono text-xs text-muted">{c.masked}</div>
                  </div>
                  {c.lastVerifiedOk === true && <Pill tone="ok">verificada</Pill>}
                  {c.expiresAt && <Pill tone={c.expiring === true ? "warn" : "muted"}>expira {fmtDate(c.expiresAt)}</Pill>}
                  <Pill tone={toneFor(c.status)}>{c.status}</Pill>
                  <div className="flex items-center gap-1">
                    <IconBtn title="Testar credencial" onClick={() => void post("credential_test", { id: c.id })} busy={busyKey === "credential_test"}>
                      <Send className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Revogar credencial" onClick={() => void post("credential_revoke", { id: c.id })} busy={busyKey === "credential_revoke"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <AddCredentialForm providerId={detail.id} notify={notify} onAdded={() => void onChanged()} setBusyKey={setBusyKey} busyKey={busyKey} />
          </div>
        </Ctx>

        <Ctx title={`Histórico de saúde · ${detail.healthHistory.length}`} desc="Resultados das verificações mais recentes.">
          {detail.healthHistory.length === 0 ? (
            <Empty text="Sem verificações" />
          ) : (
            <div className="space-y-2">
              {detail.healthHistory.map((h) => (
                <div key={`${h.checked_at}-${h.status}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Pill tone={toneFor(h.status)}>{h.status}</Pill>
                  <span className="text-muted">{h.response_time_ms == null ? "—" : `${h.response_time_ms} ms`}</span>
                  <span className="flex-1 text-muted">{h.error_message ?? h.error_class ?? "OK"}</span>
                  <span className="text-muted">{dateTime(h.checked_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Ctx>

        <Ctx title={`Sincronizações · ${detail.syncs.length}`} desc="Últimos trabalhos de sincronização deste fornecedor.">
          {detail.syncs.length === 0 ? (
            <Empty text="Sem sincronizações" />
          ) : (
            <div className="space-y-2">
              {detail.syncs.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Pill tone={toneFor(s.status)}>{s.status}</Pill>
                  <span className="font-medium text-paper">{SERVICE_LABEL[s.service] ?? s.service}</span>
                  <span className="text-muted">{s.recordsProcessed} recurso(s)</span>
                  {s.lastError && <span className="flex-1 truncate text-brand">{s.lastError}</span>}
                  <span className="text-muted">{dateTime(s.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Ctx>

        {detail.webhooks.length > 0 && (
          <Ctx title={`Webhooks · ${detail.webhooks.length}`} desc="Endpoints de entrega associados a este fornecedor.">
            <div className="space-y-2">
              {detail.webhooks.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Webhook className="h-4 w-4 text-muted" />
                  <span className="font-medium text-paper">{w.name}</span>
                  <span className="text-muted">{w.url}</span>
                  <Pill tone={toneFor(w.status)}>{w.status}</Pill>
                  <span className="text-muted">{w.events.length} evento(s)</span>
                </div>
              ))}
            </div>
          </Ctx>
        )}

        {detail.activity.length > 0 && (
          <Ctx title={`Atividade · ${detail.activity.length}`} desc="Registo de operações recentes.">
            <div className="space-y-2">
              {detail.activity.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Pill tone={a.level === "error" ? "danger" : a.level === "warn" ? "warn" : "muted"}>{a.level}</Pill>
                  <span className="font-mono text-muted">{a.event}</span>
                  <span className="flex-1 text-paper">{a.message}</span>
                  <span className="text-muted">{dateTime(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </Ctx>
        )}
      </div>
    </div>
  );
}

function AddCredentialForm({
  providerId,
  notify,
  onAdded,
  setBusyKey,
  busyKey,
}: {
  providerId: string;
  notify: Notify;
  onAdded: () => void;
  setBusyKey: (k: string | null) => void;
  busyKey: string | null;
}) {
  const [field, setField] = useState("api_token");
  const [value, setValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function add() {
    if (!field.trim() || value.length < 6) {
      notify("error", "Preencha o campo e o valor (mín. 6 caracteres).");
      return;
    }
    setBusyKey("credential_add");
    try {
      const res = await fetch("/api/admin/infra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "credential_add", providerId, field: field.trim(), value, expiresAt: expiresAt || null }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Não foi possível guardar a credencial.");
      notify("ok", "Credencial guardada e verificada.");
      setValue("");
      setExpiresAt("");
      onAdded();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Não foi possível guardar a credencial.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="mb-2 text-xs font-semibold text-paper">Adicionar credencial</div>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Campo (ex.: api_token, cpanel_username)">
          <input value={field} onChange={(e) => setField(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Valor (secreto)">
          <input type="password" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Expira em (opcional)">
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex items-end">
          <ActionBtn onClick={() => void add()} busy={busyKey === "credential_add"} tone="brand" title="Guardar credencial encriptada">
            <Plus className="h-3.5 w-3.5" /> Guardar
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Health
 * ------------------------------------------------------------------ */

function HealthTab({ notify }: { notify: Notify }) {
  const [checks, setChecks] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/infra?view=health", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao listar verificações.");
      setChecks(json.checks as HealthRow[]);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao listar verificações.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(() => void load());
  }, [load]);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/infra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "health_runall" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Não foi possível executar as verificações.");
      notify("ok", `Verificações concluídas · ${json.checked} verificados.`);
      await load();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Não foi possível executar as verificações.");
    } finally {
      setBusy(false);
    }
  }

  const count = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const c of checks) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    return byStatus;
  }, [checks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(count).map(([status, n]) => (
            <span key={status} className="inline-flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs">
              <Pill tone={toneFor(status)}>{status}</Pill> {n}
            </span>
          ))}
          {checks.length === 0 && <span className="text-sm text-muted">Sem verificações registadas.</span>}
        </div>
        <ActionBtn onClick={() => void run()} busy={busy} tone="brand" title="Correr verificações de saúde agora">
          <Activity className="h-3.5 w-3.5" /> Verificar tudo
        </ActionBtn>
      </div>

      {loading && checks.length === 0 ? (
        <div className={`${card} flex items-center justify-center py-16`}>
          <Spinner />
        </div>
      ) : (
        <Ctx title={`Health checks · ${checks.length}`} desc="Resultados mais recentes por fornecedor.">
          {checks.length === 0 ? (
            <Empty text="Sem verificações — corra a verificação para obter dados." />
          ) : (
            <div className="space-y-2">
              {checks.map((c) => (
                <div key={`${c.checked_at}-${c.provider_id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Pill tone={toneFor(c.status)}>{c.status}</Pill>
                  <span className="font-mono text-muted">{c.provider_id.slice(0, 8)}</span>
                  <span className="text-muted">{c.response_time_ms == null ? "—" : `${c.response_time_ms} ms`}</span>
                  <span className="flex-1 truncate text-paper">{c.error_message ?? c.error_class ?? "OK"}</span>
                  <span className="text-muted">{dateTime(c.checked_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Ctx>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Credentials
 * ------------------------------------------------------------------ */

function CredentialsTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/infra?view=credentials", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao listar credenciais.");
      setRows((json.credentials as CredentialRow[]).map(markExpiring));
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao listar credenciais.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(() => void load());
  }, [load]);

  async function post(action: string, payload: Record<string, unknown>) {
    setBusyKey(action);
    try {
      const res = await fetch("/api/admin/infra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ação falhou.");
      notify("ok", json.message ?? "Ação concluída.");
      await load();
      return true;
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Ação falhou.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  const [rotateValue, setRotateValue] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ActionBtn
          onClick={() => void post("credential_expiry_check", {})}
          busy={busyKey === "credential_expiry_check"}
          title="Verificar credenciais que expiram nos próximos 14 dias"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Verificar expirações
        </ActionBtn>
      </div>

      {loading && rows.length === 0 ? (
        <div className={`${card} flex items-center justify-center py-16`}>
          <Spinner />
        </div>
      ) : (
        <Ctx title={`Credenciais · ${rows.length}`} desc="Todas as credenciais dos fornecedores — valores nunca visíveis.">
          {rows.length === 0 ? (
            <Empty text="Sem credenciais — adicione-as a partir do detalhe de um fornecedor." />
          ) : (
            <div className="space-y-2">
              {rows.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <KeyRound className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-paper">
                      {c.field}{" "}
                      {c.providerSlug && <span className="text-xs text-muted">· {c.providerSlug}</span>}
                    </div>
                    <div className="font-mono text-xs text-muted">{c.masked}</div>
                  </div>
                  {c.lastVerifiedOk === true && <Pill tone="ok">verificada</Pill>}
                  {c.expiresAt && (
                    <Pill tone={c.expiring === true ? "warn" : "muted"}>expira {fmtDate(c.expiresAt)}</Pill>
                  )}
                  <Pill tone={toneFor(c.status)}>{c.status}</Pill>
                  <div className="flex items-center gap-1">
                    <IconBtn title="Testar credencial" onClick={() => void post("credential_test", { id: c.id })} busy={busyKey === "credential_test"}>
                      <Send className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Rotacionar credencial (novo valor)" onClick={() => void post("credential_rotate", { id: c.id, value: rotateValue[c.id] ?? "" })} busy={busyKey === "credential_rotate"}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Revogar credencial" onClick={() => void post("credential_revoke", { id: c.id })} busy={busyKey === "credential_revoke"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                  <input
                    value={rotateValue[c.id] ?? ""}
                    onChange={(e) => setRotateValue((v) => ({ ...v, [c.id]: e.target.value }))}
                    placeholder="novo valor p/ rotação"
                    className="w-48 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-paper"
                  />
                </div>
              ))}
            </div>
          )}
        </Ctx>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Syncs
 * ------------------------------------------------------------------ */

function SyncsTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `&status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/admin/infra?view=syncs${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao listar sincronizações.");
      setRows(json.syncs as SyncRow[]);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao listar sincronizações.");
    } finally {
      setLoading(false);
    }
  }, [notify, status]);

  useEffect(() => {
    void Promise.resolve().then(() => void load());
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-paper">
          <option value="">Todos os estados</option>
          <option value="pending">pendente</option>
          <option value="running">em execução</option>
          <option value="completed">concluída</option>
          <option value="failed">falhada</option>
          <option value="cancelled">cancelada</option>
        </select>
        <ActionBtn onClick={() => void load()} title="Atualizar lista">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </ActionBtn>
      </div>

      {loading && rows.length === 0 ? (
        <div className={`${card} flex items-center justify-center py-16`}>
          <Spinner />
        </div>
      ) : (
        <Ctx title={`Sincronizações · ${rows.length}`} desc="Trabalhos de sincronização executados por serviço.">
          {rows.length === 0 ? (
            <Empty text="Sem sincronizações" />
          ) : (
            <div className="space-y-2">
              {rows.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Pill tone={toneFor(s.status)}>{s.status}</Pill>
                  <span className="font-medium text-paper">{SERVICE_LABEL[s.service] ?? s.service}</span>
                  <Pill tone="muted">{KIND_LABEL[s.kind] ?? s.kind}</Pill>
                  {s.providerSlug && <span className="text-muted">{s.providerSlug}</span>}
                  <span className="text-muted">{s.recordsProcessed} recurso(s)</span>
                  <span className="flex-1 truncate text-brand">{s.lastError}</span>
                  <span className="text-muted">{dateTime(s.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Ctx>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Webhooks
 * ------------------------------------------------------------------ */

function WebhooksTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<WebhookRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, evRes] = await Promise.all([
        fetch("/api/admin/infra?view=webhooks", { cache: "no-store" }),
        showEvents ? fetch("/api/admin/infra?view=events", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const whJson = await whRes.json();
      if (!whJson.ok) throw new Error(whJson.error ?? "Erro ao listar webhooks.");
      setRows(whJson.webhooks as WebhookRow[]);
      if (evRes) {
        const evJson = await evRes.json();
        setEvents((evJson.ok ? evJson.events : []) as EventRow[]);
      }
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao listar webhooks.");
    } finally {
      setLoading(false);
    }
  }, [notify, showEvents]);

  useEffect(() => {
    void Promise.resolve().then(() => void load());
  }, [load]);

  async function post(action: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
    setBusyKey(action);
    try {
      const res = await fetch("/api/admin/infra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ação falhou.");
      notify("ok", json.message ?? "Ação concluída.");
      await load();
      return json;
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Ação falhou.");
      return null;
    } finally {
      setBusyKey(null);
    }
  }

  async function saveEndpoint(input: {
    id?: string;
    name: string;
    url: string;
    service: string;
    events: string[];
    status: string;
    generateSecret: boolean;
  }) {
    const json = await post("webhook_save", {
      id: input.id,
      name: input.name,
      url: input.url,
      service: input.service,
      events: input.events,
      status: input.status,
      generateSecret: input.generateSecret,
    });
    if (json && typeof json.secret === "string") {
      setNewSecret(json.secret);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setShowEvents(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${!showEvents ? "bg-brand text-white" : "border border-line bg-surface-2 text-muted hover:text-paper"}`}
          >
            Endpoints
          </button>
          <button
            type="button"
            onClick={() => setShowEvents(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${showEvents ? "bg-brand text-white" : "border border-line bg-surface-2 text-muted hover:text-paper"}`}
          >
            Eventos recebidos
          </button>
        </div>
        <ActionBtn onClick={() => { setEditing(null); setCreating(true); }} tone="brand" title="Criar novo endpoint de webhook">
          <Plus className="h-3.5 w-3.5" /> Novo endpoint
        </ActionBtn>
      </div>

      {newSecret && (
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
          <div className="mb-1 text-xs font-semibold text-brand">Segredo gerado — guarde-o agora</div>
          <div className="font-mono text-xs break-all text-paper">{newSecret}</div>
          <div className="mt-1 text-xs text-muted">O segredo não voltará a ser mostrado. Use-o como assinatura (HMAC-SHA256) no recetor.</div>
          <button type="button" onClick={() => setNewSecret(null)} className="mt-2 text-xs text-brand hover:underline">
            Fechar
          </button>
        </div>
      )}

      {(creating || editing) && (
        <WebhookForm
          initial={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSave={(input) =>
            saveEndpoint({ ...input, id: editing?.id, generateSecret: !editing && input.generateSecret })
          }
          busy={busyKey === "webhook_save"}
        />
      )}

      {loading && rows.length === 0 && !showEvents ? (
        <div className={`${card} flex items-center justify-center py-16`}>
          <Spinner />
        </div>
      ) : showEvents ? (
        <Ctx title={`Eventos recebidos · ${events.length}`} desc="Entradas processadas no recetor de webhooks.">
          {events.length === 0 ? (
            <Empty text="Sem eventos recebidos" />
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Pill tone={e.signature_verified ? toneFor(e.status) : "danger"}>{e.signature_verified ? e.status : "rejeitado"}</Pill>
                  <span className="font-medium text-paper">{e.event}</span>
                  <span className="font-mono text-muted">{e.source}</span>
                  <span className="flex-1 truncate text-muted">{e.error}</span>
                  <span className="text-muted">{dateTime(e.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Ctx>
      ) : (
        <Ctx title={`Endpoints · ${rows.length}`} desc="Endpoints de entrega de notificações dos fornecedores.">
          {rows.length === 0 ? (
            <Empty text="Sem endpoints — crie um endpoint para receber/enviar eventos." />
          ) : (
            <div className="space-y-2">
              {rows.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
                  <Webhook className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-paper">{w.name}</div>
                    <div className="truncate text-muted">{w.url}</div>
                  </div>
                  {w.providerSlug && <span className="text-muted">{w.providerSlug}</span>}
                  <Pill tone="muted">{SERVICE_LABEL[w.service] ?? w.service}</Pill>
                  <Pill tone={toneFor(w.status)}>{w.status}</Pill>
                  <span className="text-muted">{w.events.length} evento(s)</span>
                  {w.lastStatus && <Pill tone={w.lastStatus.startsWith("2") ? "ok" : "warn"}>última {w.lastStatus}</Pill>}
                  <div className="flex items-center gap-1">
                    <IconBtn title="Testar entrega" onClick={() => void post("webhook_test", { id: w.id })} busy={busyKey === "webhook_test"}>
                      <Send className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Editar" onClick={() => { setEditing(w); setCreating(false); }}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Remover" onClick={() => void post("webhook_delete", { id: w.id })} busy={busyKey === "webhook_delete"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Ctx>
      )}
    </div>
  );
}

function WebhookForm({
  initial,
  onCancel,
  onSave,
  busy,
}: {
  initial: WebhookRow | null;
  onCancel: () => void;
  onSave: (input: { name: string; url: string; service: string; events: string[]; status: string; generateSecret: boolean }) => void | Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [service, setService] = useState(initial?.service ?? "hosting");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [events, setEvents] = useState<string[]>(initial?.events ?? []);
  const [generateSecret, setGenerateSecret] = useState(false);

  const toggle = (e: string) => {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold text-paper">{initial ? `Editar · ${initial.name}` : "Novo endpoint de webhook"}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="URL de entrega (HTTPS)">
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://…" />
        </Field>
        <Field label="Serviço">
          <select value={service} onChange={(e) => setService(e.target.value)} className={inputCls}>
            {Object.entries(SERVICE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 text-xs font-medium text-muted">Eventos para subscrever</div>
        <div className="flex flex-wrap gap-1.5">
          {EVENTS_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => toggle(e)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${events.includes(e) ? "bg-brand text-white" : "border border-line bg-surface-2 text-muted hover:text-paper"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      {!initial && (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={generateSecret} onChange={(e) => setGenerateSecret(e.target.checked)} />
          Gerar um segredo de assinatura (HMAC) e mostrá-lo uma vez
        </label>
      )}
      <div className="mt-4 flex items-center gap-2">
        <ActionBtn onClick={() => void onSave({ name, url, service, events, status, generateSecret })} busy={busy} tone="brand" title="Guardar endpoint">
          <Check className="h-3.5 w-3.5" /> Guardar
        </ActionBtn>
        <ActionBtn onClick={onCancel} title="Cancelar">
          Cancelar
        </ActionBtn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------ */

function ActivityTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/infra?view=activity", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao listar a atividade.");
      setRows(json.activity as ActivityRow[]);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao listar a atividade.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(() => void load());
  }, [load]);

  return (
    <Ctx title={`Atividade · ${rows.length}`} desc="Registo de eventos dos fornecedores (nunca contém segredos)." right={<ActionBtn onClick={() => void load()} title="Atualizar">Atualizar</ActionBtn>}>
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Empty text="Sem atividade" />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
              <Pill tone={a.level === "error" ? "danger" : a.level === "warn" ? "warn" : "muted"}>{a.level}</Pill>
              <span className="font-mono text-muted">{a.event}</span>
              {a.providerSlug && <span className="text-muted">{a.providerSlug}</span>}
              <span className="flex-1 text-paper">{a.message}</span>
              <span className="text-muted">{dateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Ctx>
  );
}