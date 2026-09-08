"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileSignature,
  Link2,
  Download,
  Save,
  Send,
  Trash2,
  X,
  ClipboardList,
} from "lucide-react";
import { card, Empty, Pill, SectionHead, Spinner } from "./views";
import type { Notify } from "./types";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  buildProposal,
  computeProposal,
  downloadProposalPdf,
  proposalShareUrl,
  type Proposal,
  type ProposalDraft,
  type ProposalLine,
  type ProposalServiceItem,
  type ProposalServiceKey,
  type ProposalStatus,
} from "@/lib/proposals";
import { fmtMT } from "@/lib/invoices";
import type { CompanyInfo } from "@/lib/site-settings";

export const inputCls =
  "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function blankDraft(): ProposalDraft {
  return {
    title: "",
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    lines: [],
    discountPercent: 0,
    taxRate: 15,
    validityDays: 30,
    notes: "",
  };
}

const FILTERS: Array<ProposalStatus | "all"> = ["all", "draft", "sent", "approved", "rejected", "changes_requested"];

export function ProposalsSystemView({ notify, company, catalog }: { notify: Notify; company: CompanyInfo; catalog: readonly ProposalServiceItem[] }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ProposalStatus | "all">("all");
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [draft, setDraft] = useState<ProposalDraft>(blankDraft());

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/proposals", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        notify("error", json.error ?? "Não foi possível listar as propostas.");
      } else {
        setProposals(json.proposals ?? []);
      }
    } catch {
      notify("error", "Não foi possível listar as propostas.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/proposals", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          notify("error", json.error ?? "Não foi possível listar as propostas.");
        } else {
          setProposals(json.proposals ?? []);
        }
      } catch {
        if (!cancelled) notify("error", "Não foi possível listar as propostas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const computed = computeProposal(draft);

  function toggleService(key: ProposalServiceKey) {
    setDraft((d) => {
      if (d.lines.some((l) => l.key === key)) {
        return { ...d, lines: d.lines.filter((l) => l.key !== key) };
      }
      const cat = catalog.find((s) => s.key === key)!;
      const line: ProposalLine = { key, label: cat.label, detail: cat.detail, qty: 1, unitPrice: cat.defaultPrice };
      return { ...d, lines: [...d.lines, line] };
    });
  }

  function updateLine(key: ProposalServiceKey, patch: Partial<ProposalLine>) {
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  }

  function resetEditor() {
    setEditing(null);
    setDraft(blankDraft());
  }

  function loadEditor(p: Proposal) {
    setEditing(p);
    setDraft({
      title: p.title,
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      clientCompany: p.clientCompany,
      lines: p.lines,
      discountPercent: p.discountPercent,
      taxRate: p.taxRate,
      validityDays: p.validityDays,
      notes: p.notes,
    });
  }

  async function save(status: ProposalStatus) {
    if (!draft.title.trim() || !draft.clientName.trim()) {
      return notify("error", "Preenche o título e o nome do cliente.");
    }
    if (draft.lines.length === 0) {
      return notify("error", "Seleciona pelo menos um serviço.");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing?.id ?? undefined, status, draft }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        return notify("error", json.error ?? "Não foi possível guardar.");
      }
      const saved: Proposal = json.proposal;
      notify("ok", status === "sent" ? "Proposta enviada com link de revisão." : "Proposta guardada.");
      if (status === "sent") {
        await copyLink(saved.token);
        notify("ok", "Link de revisão copiado.");
      }
      setEditing(null);
      setDraft(blankDraft());
      fetchList();
    } catch {
      notify("error", "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(token: string) {
    const url = proposalShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Link de revisão:", url);
    }
  }

  async function removeProposal(p: Proposal) {
    if (!window.confirm(`Eliminar a proposta ${p.code}?`)) return;
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: p.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        return notify("error", json.error ?? "Não foi possível eliminar.");
      }
      notify("ok", `Proposta ${p.code} eliminada.`);
      if (editing?.id === p.id) resetEditor();
      fetchList();
    } catch {
      notify("error", "Não foi possível eliminar.");
    }
  }

  function printDraft() {
    if (draft.lines.length === 0) return notify("error", "Não há serviços para imprimir.");
    const p = buildProposal(draft, {
      id: editing?.id ?? "novo",
      code: editing?.code ?? "PRO-NOVO",
      token: editing?.token ?? "novo",
      status: editing?.status ?? "draft",
      clientComment: editing?.clientComment ?? "",
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      updatedAt: editing?.updatedAt ?? new Date().toISOString(),
    });
    const total = downloadProposalPdf(p, company);
    notify("ok", `PDF da proposta aberto — guarda como PDF. Total ${total} MT.`);
  }

  const visible = proposals.filter((p) => filter === "all" || p.status === filter);

  return (
    <div className="space-y-6">
      <SectionHead
        title="Sistema de Propostas"
        desc="Constrói propostas com Website, Alojamento, Domínio, SEO, Marketing e Manutenção — e acompanha a revisão do cliente."
        right={
          <div className="flex items-center gap-2">
            {editing && (
              <button type="button" onClick={resetEditor} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-paper">
                <X className="h-4 w-4" /> Nova proposta
              </button>
            )}
            <button type="button" onClick={fetchList} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-paper disabled:opacity-50">
              <ClipboardList className="h-4 w-4" /> Atualizar
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Editor */}
        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-brand" />
            <h3 className="text-[13.2px] font-semibold text-paper">
              {editing ? `A editar ${editing.code}` : "Nova proposta"}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Título da proposta">
              <input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: Novo website + branding" />
            </Field>
            <Field label="Nome do cliente">
              <input className={inputCls} value={draft.clientName} onChange={(e) => setDraft({ ...draft, clientName: e.target.value })} />
            </Field>
            <Field label="Empresa">
              <input className={inputCls} value={draft.clientCompany} onChange={(e) => setDraft({ ...draft, clientCompany: e.target.value })} />
            </Field>
            <Field label="Email do cliente">
              <input className={inputCls} value={draft.clientEmail} onChange={(e) => setDraft({ ...draft, clientEmail: e.target.value })} />
            </Field>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Serviços</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {catalog.map((cat) => {
                const line = draft.lines.find((l) => l.key === cat.key);
                const active = !!line;
                return (
                  <div
                    key={cat.key}
                    className={`rounded-lg border p-3 transition-colors ${active ? "border-brand bg-brand/5" : "border-line bg-ink hover:border-brand/50"}`}
                  >
                    <button type="button" onClick={() => toggleService(cat.key)} className="flex w-full items-start justify-between gap-2 text-left">
                      <span>
                        <span className="block text-sm font-medium text-paper">{cat.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{cat.detail}</span>
                      </span>
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-content-center rounded border text-[11px] ${active ? "border-brand bg-brand text-white" : "border-line text-muted"}`}>
                        {active ? "✓" : "+"}
                      </span>
                    </button>
                    {active && (
                      <div className="mt-3 grid grid-cols-2 items-end gap-2">
                        <Field label="Qtd">
                          <input type="number" min="1" className={inputCls} value={line.qty} onChange={(e) => updateLine(cat.key, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                        </Field>
                        <Field label="Preço (MT)">
                          <input type="number" min="0" className={inputCls} value={line.unitPrice} onChange={(e) => updateLine(cat.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Field label="Desconto (%)">
              <input type="number" min="0" max="100" className={inputCls} value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Taxa (%)">
              <input type="number" min="0" max="100" className={inputCls} value={draft.taxRate} onChange={(e) => setDraft({ ...draft, taxRate: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Validade (dias)">
              <input type="number" min="1" className={inputCls} value={draft.validityDays} onChange={(e) => setDraft({ ...draft, validityDays: Math.max(1, Number(e.target.value) || 1) })} />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Notas">
              <textarea className={inputCls} rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Condições, prazos, inclusões…" />
            </Field>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className={`${card} sticky top-24`}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Resumo</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-medium text-paper">{fmtMT(computed.subtotal)} MT</span>
              </div>
              {computed.discountAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Desconto ({computed.discountPercent}%)</span>
                  <span className="font-medium text-paper">-{fmtMT(computed.discountAmount)} MT</span>
                </div>
              )}
              {computed.taxAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Imposto ({computed.taxRate}%)</span>
                  <span className="font-medium text-paper">+{fmtMT(computed.taxAmount)} MT</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="font-semibold text-paper">Total</span>
                <span className="text-lg font-bold text-brand">{fmtMT(computed.total)} MT</span>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <motion.button
                type="button"
                onClick={() => save("draft")}
                disabled={saving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {saving ? <Spinner /> : <Save className="h-4 w-4" />} Guardar rascunho
              </motion.button>
              <motion.button
                type="button"
                onClick={() => save("sent")}
                disabled={saving || draft.lines.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                {saving ? <Spinner /> : <Send className="h-4 w-4" />} Guardar e enviar
              </motion.button>
              <motion.button
                type="button"
                onClick={printDraft}
                disabled={draft.lines.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Descarregar PDF
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className={card}>
        <SectionHead
          title={`Propostas · ${visible.length}`}
          right={
            <select className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-paper outline-none" value={filter} onChange={(e) => setFilter(e.target.value as ProposalStatus | "all")}>
              {FILTERS.map((f) => (
                <option key={f} value={f}>{f === "all" ? "Todas" : PROPOSAL_STATUS_LABEL[f as ProposalStatus]}</option>
              ))}
            </select>
          }
        />
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : visible.length === 0 ? (
          <Empty text="Ainda não há propostas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Código</th>
                  <th className="px-2 py-2 font-medium">Cliente</th>
                  <th className="px-2 py-2 font-medium">Título</th>
                  <th className="px-2 py-2 font-medium">Total</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                    <td className="px-2 py-3 font-medium text-paper">{p.code}</td>
                    <td className="px-2 py-3">
                      <p className="text-paper">{p.clientName}</p>
                      <p className="text-[11px] text-muted">{p.clientCompany || p.clientEmail || "—"}</p>
                    </td>
                    <td className="px-2 py-3 text-muted">{p.title}</td>
                    <td className="px-2 py-3 font-medium text-paper">{fmtMT(p.total)} MT</td>
                    <td className="px-2 py-3">
                      <Pill tone={PROPOSAL_STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</Pill>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => loadEditor(p)} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                          <FileSignature className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => copyLink(p.token)} title="Copiar link de revisão" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => downloadProposalPdf(p, company)} title="PDF" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => removeProposal(p)} title="Eliminar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {proposals.some((p) => p.status === "changes_requested") && (
          <div className="mt-4 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-paper">
            <span className="font-semibold">Alterações pedidas:</span>{" "}
            {proposals.filter((p) => p.status === "changes_requested").map((p) => (
              <span key={p.id} className="mr-3">
                {p.code} — <span className="text-muted">{p.clientComment || "sem comentário"}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}