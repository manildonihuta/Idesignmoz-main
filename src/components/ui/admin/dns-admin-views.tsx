"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Globe, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { Notify } from "./types";
import { ActionBtn, Empty, IconBtn, Pill, Spinner, card, fmtDate } from "./views";
import {
  DNSSEC_LABELS,
  ZONE_STATUS_LABELS,
  type DnsActivity,
  type DnsBundle,
  type DnsRecord,
  type DnsRecordInput,
  type DnsZone,
} from "@/lib/dns/types";

type ZoneRow = { zone: DnsZone; records: DnsRecord[]; lastActivity: DnsActivity | null };

const STATUS_TONE: Record<DnsZone["status"], "ok" | "warn" | "muted" | "danger"> = {
  active: "ok",
  pending: "warn",
  manual: "warn",
  disabled: "muted",
  error: "danger",
};

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"] as const;

export function DnsZonesView({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bundle, setBundle] = useState<DnsBundle | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DnsRecordInput>>({ type: "A", name: "@", ttl: 3600 });
  const [ns, setNs] = useState<Record<string, string>>({});

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dns", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar zonas DNS.");
      setRows(json.zones ?? []);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar zonas DNS.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(() => void loadRows());
  }, [loadRows]);

  async function openZone(zoneId: string) {
    if (expanded === zoneId) {
      setExpanded(null);
      setBundle(null);
      return;
    }
    setExpanded(zoneId);
    setBusyKey(`bundle-${zoneId}`);
    try {
      const res = await fetch(`/api/admin/dns?zoneId=${zoneId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao carregar a zona.");
      setBundle(json.bundle ?? null);
      setNs(json.bundle?.zone.nameservers ?? {});
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao carregar a zona.");
      setExpanded(null);
    } finally {
      setBusyKey(null);
    }
  }

  async function post(zoneId: string, action: string, body: Record<string, unknown> = {}, okText: string, usesBundle = true) {
    setBusyKey(`${action}-${zoneId}`);
    try {
      const res = await fetch("/api/admin/dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, zoneId, ...body }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro.");
      if (usesBundle && json.bundle) setBundle(json.bundle);
      notify("ok", okText);
      await loadRows();
      return json;
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro na operação DNS.");
      return null;
    } finally {
      setBusyKey(null);
    }
  }

  function addRecord() {
    if (!expanded) return;
    const input: DnsRecordInput = {
      type: (form.type as DnsRecordInput["type"]) ?? "A",
      name: (form.name ?? "@").trim() || "@",
      value: (form.value ?? "").trim(),
      ttl: typeof form.ttl === "number" ? form.ttl : 3600,
      priority: form.priority == null || form.priority === 0 ? null : Number(form.priority),
    };
    if (!input.value) {
      notify("error", "Indique o valor do registo.");
      return;
    }
    void post(expanded, "record_create", { record: input }, "Registo DNS criado.");
  }

  function saveNameservers() {
    if (!expanded) return;
    void post(expanded, "nameservers", { nameservers: ns }, "Nameservers atualizados.");
  }

  return (
    <div className={card}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[10.8px] font-semibold text-paper">Zonas DNS</h2>
          <p className="mt-0.5 text-sm text-muted">
            {rows.length ? `${rows.length} zonas geridas · provider: ${rows[0]?.zone.provider ?? "—"}` : "Gestão central do DNS dos domínios."}
          </p>
        </div>
        <ActionBtn tone="ghost" busy={loading} onClick={() => void loadRows()}>
          <RefreshCw className="h-3.5 w-3.5" /> Recarregar
        </ActionBtn>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty text="Ainda não existem zonas DNS. As zonas são criadas quando os clientes abrem a gestão de DNS de um domínio." />
      ) : (
        <div className="divide-y divide-line">
          {rows.map((row, i) => {
            const zone = row.zone;
            const open = expanded === zone.id;
            return (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
              >
                <div className="flex flex-wrap items-center gap-3 py-3">
                  <IconBtn title={open ? "Fechar detalhe" : "Abrir detalhe"} busy={busyKey === `bundle-${zone.id}`} onClick={() => void openZone(zone.id)}>
                    {open ? <ChevronDown className="h-4 w-4 rotate-180" /> : <ChevronDown className="h-4 w-4" />}
                  </IconBtn>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-paper">{zone.fullDomain}</p>
                    <p className="text-xs text-muted">
                      {row.records.length} registos {row.lastActivity ? `· última ação ${fmtDate(row.lastActivity.createdAt)}` : "· sem atividade"}
                    </p>
                  </div>
                  <Pill tone={STATUS_TONE[zone.status]}>{ZONE_STATUS_LABELS[zone.status]}</Pill>
                  <Pill tone={zone.dnssec === "active" ? "ok" : zone.dnssec === "pending" ? "warn" : "muted"}>{DNSSEC_LABELS[zone.dnssec]}</Pill>
                  <div className="flex items-center gap-1.5">
                    <ActionBtn tone="ghost" busy={busyKey === `zone_sync-${zone.id}`} title="Voltar a sincronizar a zona" onClick={() => void post(zone.id, "zone_sync", {}, "Zona sincronizada.")}>
                      <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
                    </ActionBtn>
                    <IconBtn busy={busyKey === `zone_delete-${zone.id}`} title="Eliminar zona" onClick={() => setDeleteConfirm(zone.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
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
                      {bundle && bundle.zone.id === zone.id ? (
                        <ZoneDetail
                          zone={zone}
                          bundle={bundle}
                          form={form}
                          setForm={setForm}
                          ns={ns}
                          setNs={setNs}
                          busyKey={busyKey}
                          onAddRecord={addRecord}
                          onSaveNameservers={saveNameservers}
                          onToggleDnssec={() => void post(zone.id, "dnssec", { enabled: zone.dnssec === "disabled" || zone.dnssec === "error" }, zone.dnssec === "disabled" ? "DNSSEC ativado." : "DNSSEC desativado.")}
                          onDeleteRecord={(recordId) => void post(zone.id, "record_delete", { recordId }, "Registo DNS removido.")}
                          onCheckPropagation={() => void post(zone.id, "propagation", {}, "Propagação verificada.")}
                        />
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
        {deleteConfirm && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-content-center bg-black/60 p-4"
            onClick={() => setDeleteConfirm(null)}
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
                <h3 className="text-sm font-semibold text-paper">Eliminar zona DNS</h3>
              </div>
              <p className="text-sm text-muted">Vais remover a zona e todos os seus registos. Esta ação não pode ser revertida.</p>
              <div className="mt-5 flex justify-end gap-2">
                <ActionBtn tone="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</ActionBtn>
                <ActionBtn tone="danger" busy={busyKey === `zone_delete-${deleteConfirm}`} onClick={() => {
                  const id = deleteConfirm;
                  setDeleteConfirm(null);
                  void post(id, "zone_delete", {}, "Zona DNS eliminada.");
                  if (expanded === id) { setExpanded(null); setBundle(null); }
                }}>
                  Eliminar
                </ActionBtn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ZoneDetail({
  zone,
  bundle,
  form,
  setForm,
  ns,
  setNs,
  busyKey,
  onAddRecord,
  onSaveNameservers,
  onToggleDnssec,
  onDeleteRecord,
  onCheckPropagation,
}: {
  zone: DnsZone;
  bundle: DnsBundle;
  form: Partial<DnsRecordInput>;
  setForm: (v: Partial<DnsRecordInput>) => void;
  ns: Record<string, string>;
  setNs: (v: Record<string, string>) => void;
  busyKey: string | null;
  onAddRecord: () => void;
  onSaveNameservers: () => void;
  onToggleDnssec: () => void;
  onDeleteRecord: (recordId: string) => void;
  onCheckPropagation: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 pb-4 lg:grid-cols-2">
      <div className="space-y-4 rounded-lg border border-line bg-ink p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-paper"><Globe className="h-4 w-4 text-brand" /> {zone.fullDomain}</h4>
          <ActionBtn tone="ghost" busy={busyKey === `propagation-${zone.id}`} onClick={onCheckPropagation}>
            <RefreshCw className="h-3.5 w-3.5" /> Verificar propagação
          </ActionBtn>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Nameservers</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["ns1", "ns2", "ns3", "ns4"] as const).map((key) => (
              <input
                key={key}
                value={ns[key] ?? ""}
                onChange={(e) => setNs({ ...ns, [key]: e.target.value })}
                placeholder={`${key}.exemplo.com`}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-paper"
              />
            ))}
          </div>
          <div className="mt-2">
            <ActionBtn tone="ghost" busy={busyKey === `nameservers-${zone.id}`} onClick={onSaveNameservers}>Guardar nameservers</ActionBtn>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div>
            <p className="text-sm font-medium text-paper">DNSSEC</p>
            <p className="text-xs text-muted">{DNSSEC_LABELS[zone.dnssec]} · estado real, nunca simulado</p>
          </div>
          <ActionBtn tone="ghost" busy={busyKey === `dnssec-${zone.id}`} onClick={onToggleDnssec}>
            {zone.dnssec === "active" ? "Desativar" : "Ativar"}
          </ActionBtn>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-line bg-ink p-4">
        <h4 className="text-sm font-medium text-paper">Registos ({bundle.records.length})</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            value={form.type ?? "A"}
            onChange={(e) => setForm({ ...form, type: e.target.value as DnsRecordInput["type"] })}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-paper"
            aria-label="Tipo de registo"
          >
            {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            value={form.name ?? ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome (@ para raiz)"
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-paper"
            aria-label="Nome"
          />
          <input
            value={form.value ?? ""}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="Valor"
            className="col-span-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-paper sm:col-span-1"
            aria-label="Valor"
          />
          <input
            type="number"
            value={form.priority ?? ""}
            onChange={(e) => setForm({ ...form, priority: e.target.value ? Number(e.target.value) : null })}
            placeholder="Prioridade (opcional)"
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-paper"
            aria-label="Prioridade"
          />
          <input
            type="number"
            value={form.ttl ?? 3600}
            onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) || 3600 })}
            placeholder="TTL"
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-paper"
            aria-label="TTL"
          />
        </div>
        <ActionBtn tone="brand" busy={busyKey === `record_create-${zone.id}`} onClick={onAddRecord}>
          <Plus className="h-3.5 w-3.5" /> Adicionar registo
        </ActionBtn>

        <div className="divide-y divide-line">
          {bundle.records.length === 0 ? (
            <p className="py-2 text-sm text-muted">Sem registos nesta zona.</p>
          ) : (
            bundle.records.slice(0, 30).map((record) => (
              <div key={record.id} className="flex items-center gap-3 py-2">
                <span className="w-14 shrink-0 font-mono text-xs text-paper">{record.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-paper">{record.name}</p>
                  <p className="truncate text-[11px] text-muted">{record.value}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted">{record.ttl}</span>
                <IconBtn
                  busy={busyKey === `record_delete-${zone.id}`}
                  title="Remover registo"
                  onClick={() => {
                    if (window.confirm(`Remover o registo ${record.type} ${record.name}?`)) onDeleteRecord(record.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-ink p-4 lg:col-span-2">
        <h4 className="mb-2 text-sm font-medium text-paper">Atividade recente</h4>
        {bundle.activities.length === 0 ? (
          <p className="text-sm text-muted">Sem atividade registada ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {bundle.activities.slice(0, 8).map((activity) => (
              <div key={activity.id} className="rounded-md border border-line bg-surface px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-paper">{activity.action}</p>
                  <span className="shrink-0 text-[11px] text-muted">{fmtDate(activity.createdAt)}</span>
                </div>
                {activity.newValue ? <p className="mt-1 truncate font-mono text-[11px] text-muted">{activity.newValue}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}