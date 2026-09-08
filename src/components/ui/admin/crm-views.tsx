"use client";
import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Workflow,
  UserPlus,
  Users,
  Building2,
  Target,
  FileText,
  FolderKanban,
  MessageSquare,
  StickyNote,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { card, Empty, Pill, SectionHead, Spinner } from "./views";
import type { Notify } from "./types";
import { loadStore, nextId, saveStore } from "./manage-stores";
import {
  COMMUNICATION_TYPES,
  CRM_COMMUNICATIONS_KEY,
  CRM_COMPANIES_KEY,
  CRM_CONTACTS_KEY,
  CRM_LEADS_KEY,
  CRM_NOTES_KEY,
  CRM_OPPORTUNITIES_KEY,
  CRM_PROJECTS_KEY,
  CRM_PROPOSALS_KEY,
  CRM_STAGES,
  LEAD_SOURCES,
  SEED_COMMUNICATIONS,
  SEED_COMPANIES,
  SEED_CONTACTS,
  SEED_CRM_PROJECTS,
  SEED_LEADS,
  SEED_NOTES,
  SEED_OPPORTUNITIES,
  SEED_PROPOSALS,
  STAGE_LABEL,
  type CrmCommunication,
  type CrmCompany,
  type CrmContact,
  type CrmLead,
  type CrmOpportunity,
  type CrmProposal,
  type CrmProject,
  type CrmStageId,
} from "./crm-stores";

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

function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`${card} w-full ${wide ? "max-w-2xl" : "max-w-md"}`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[13.2px] font-semibold text-paper">{title}</h3>
              <button type="button" onClick={onClose} className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-paper" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SaveBar({ onCancel, onSave, busy }: { onCancel: () => void; onSave: () => void; busy?: boolean }) {
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-paper">
        Cancelar
      </button>
      <motion.button
        type="button"
        onClick={onSave}
        disabled={busy}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? <Spinner /> : <Save className="h-4 w-4" />} Guardar
      </motion.button>
    </div>
  );
}

function useCrmStore<T>(key: string, seed: T) {
  const [items, setItems] = useState<T>(() => loadStore(key, seed));
  const persist = useCallback(
    (next: T) => {
      setItems(next);
      saveStore(key, next);
    },
    [key],
  );
  return [items, persist] as const;
}

/* ------------------------------------------------------------------ */
/* CRM entry — tabbed                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "pipeline", label: "Pipeline", Icon: Workflow },
  { id: "leads", label: "Leads", Icon: UserPlus },
  { id: "contacts", label: "Contactos", Icon: Users },
  { id: "companies", label: "Empresas", Icon: Building2 },
  { id: "opportunities", label: "Oportunidades", Icon: Target },
  { id: "proposals", label: "Propostas", Icon: FileText },
  { id: "projects", label: "Projetos", Icon: FolderKanban },
  { id: "activity", label: "Comunicação", Icon: MessageSquare },
] as const;

type CrmTabId = (typeof TABS)[number]["id"];

const STAGE_TONE: Record<CrmStageId, "brand" | "warn" | "ok" | "muted"> = {
  lead: "muted",
  qualified: "warn",
  proposal: "warn",
  won: "ok",
  onboarding: "brand",
  active: "ok",
  retention: "muted",
};

export function CrmView({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState<CrmTabId>("pipeline");

  return (
    <div className="space-y-6">
      <SectionHead
        title="CRM interno"
        desc="Lead → Qualified → Proposal → Won → Onboarding → Active Customer → Retention"
        right={<p className="text-sm text-muted">Dados guardados localmente no navegador.</p>}
      />
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {tab === "pipeline" && <PipelineTab notify={notify} />}
          {tab === "leads" && <LeadsTab notify={notify} />}
          {tab === "contacts" && <ContactsTab notify={notify} />}
          {tab === "companies" && <CompaniesTab notify={notify} />}
          {tab === "opportunities" && <OpportunitiesTab notify={notify} />}
          {tab === "proposals" && <ProposalsTab notify={notify} />}
          {tab === "projects" && <ProjectsTab notify={notify} />}
          {tab === "activity" && <ActivityTab notify={notify} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: CrmTabId; setTab: (t: CrmTabId) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map(({ id, label, Icon }) => (
        <motion.button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === id ? "bg-brand text-white" : "bg-surface text-muted hover:bg-surface-2 hover:text-paper"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </motion.button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline (lifecycle kanban)                                          */
/* ------------------------------------------------------------------ */

function PipelineTab({ notify }: { notify: Notify }) {
  const [opportunities, setOpportunities] = useCrmStore(CRM_OPPORTUNITIES_KEY, SEED_OPPORTUNITIES);
  const companies = loadStore(CRM_COMPANIES_KEY, SEED_COMPANIES);

  const byStage = useMemo(() => {
    const map = new Map<CrmStageId, CrmOpportunity[]>();
    for (const stage of CRM_STAGES) map.set(stage, []);
    for (const opp of opportunities) {
      (map.get(opp.stage) ?? []).push(opp);
    }
    for (const stage of CRM_STAGES) {
      (map.get(stage) ?? []).sort((a, b) => b.value - a.value);
    }
    return map;
  }, [opportunities]);

  const totals = useMemo(() => {
    const out = new Map<CrmStageId, { count: number; value: number }>();
    for (const stage of CRM_STAGES) {
      const list = byStage.get(stage) ?? [];
      out.set(stage, { count: list.length, value: list.reduce((sum, o) => sum + o.value, 0) });
    }
    return out;
  }, [byStage]);

  const totalPipeline = useMemo(
    () => CRM_STAGES.reduce((sum, s) => sum + (totals.get(s)?.value ?? 0), 0),
    [totals],
  );

  function move(opp: CrmOpportunity, delta: number) {
    const ix = CRM_STAGES.indexOf(opp.stage);
    const nextIndex = Math.min(CRM_STAGES.length - 1, Math.max(0, ix + delta));
    const nextStage = CRM_STAGES[nextIndex];
    if (nextStage === opp.stage) return;
    setOpportunities(opportunities.map((o) => (o.id === opp.id ? { ...o, stage: nextStage, probability: Math.min(100, (CRM_STAGES.indexOf(nextStage) + 1) * 20) } : o)));
    notify("ok", `${opp.title} → ${STAGE_LABEL[nextStage]}`);
  }

  function companyName(id?: string): string {
    if (!id) return "—";
    return companies.find((c) => c.id === id)?.name ?? "—";
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Valor total pipeline" value={`${totalPipeline.toLocaleString("pt-PT")} MT`} />
        <StatCard label="Oportunidades abertas" value={String(opportunities.length)} />
        <StatCard label="Won" value={String(totals.get("won")?.count ?? 0)} sub={`${totals.get("won")?.value.toLocaleString("pt-PT")} MT`} />
        <StatCard label="Clientes ativos" value={String((totals.get("active")?.count ?? 0) + (totals.get("retention")?.count ?? 0))} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CRM_STAGES.map((stage) => {
          const list = byStage.get(stage) ?? [];
          const total = totals.get(stage);
          return (
            <div key={stage} className="rounded-xl border border-line bg-surface p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-paper">{STAGE_LABEL[stage]}</span>
                  <Pill tone={STAGE_TONE[stage]}>{total?.count ?? 0}</Pill>
                </div>
                <span className="text-xs font-medium text-muted">{(total?.value ?? 0).toLocaleString("pt-PT")} MT</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">Sem oportunidades</p>
                ) : (
                  list.map((opp) => (
                    <div key={opp.id} className="rounded-lg border border-line bg-ink p-3 transition-colors hover:border-brand">
                      <p className="text-[12.6px] font-medium text-paper">{opp.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">{companyName(opp.companyId)} · {opp.owner}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-brand">{opp.value.toLocaleString("pt-PT")} MT</span>
                        <Pill tone="muted">{opp.probability}%</Pill>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <button type="button" onClick={() => move(opp, -1)} disabled={stage === "lead"} className="inline-flex h-6 w-6 items-center justify-center rounded border border-line text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-30" title="Recuar etapa">
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <span className="text-[10px] uppercase tracking-wide text-muted">{opp.expectedClose || "sem data"}</span>
                        <button type="button" onClick={() => move(opp, 1)} disabled={stage === "retention"} className="inline-flex h-6 w-6 items-center justify-center rounded border border-line text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-30" title="Avançar etapa">
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={card}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-paper">{value}</p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leads                                                                */
/* ------------------------------------------------------------------ */

type LeadForm = Omit<CrmLead, "id" | "createdAt">;

export function LeadsTab({ notify }: { notify: Notify }) {
  const [leads, setLeads] = useCrmStore(CRM_LEADS_KEY, SEED_LEADS);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CrmLead | null>(null);
  const [draft, setDraft] = useState<LeadForm>({
    name: "",
    company: "",
    email: "",
    phone: "",
    source: "Website",
    status: "new",
    potential: 0,
  });

  function openModal(lead?: CrmLead | null) {
    setCreating(!lead);
    setEditing(lead || null);
    setDraft(
      lead
        ? { name: lead.name, company: lead.company, email: lead.email, phone: lead.phone, source: lead.source, status: lead.status, potential: lead.potential }
        : { name: "", company: "", email: "", phone: "", source: "Website", status: "new", potential: 0 },
    );
  }

  function save() {
    if (!draft.name.trim()) return notify("error", "Nome é obrigatório.");
    if (editing) {
      setLeads(leads.map((l) => (l.id === editing.id ? { ...editing, ...draft } : l)));
      notify("ok", "Lead atualizada.");
    } else {
      const lead: CrmLead = { ...draft, id: nextId("LEAD", leads, 1000), createdAt: new Date().toLocaleDateString("pt-PT") };
      setLeads([lead, ...leads]);
      notify("ok", "Lead criada.");
    }
    setCreating(false);
    setEditing(null);
  }

  const STATUS_TONE = { new: "brand", contacted: "warn", qualified: "ok", closed: "muted" } as const;

  return (
    <div className="space-y-4">
      <SectionHead
        title={`Leads · ${leads.length}`}
        right={
          <button type="button" onClick={() => openModal()} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Novo lead
          </button>
        }
      />
      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Lead</th>
                <th className="px-2 py-2 font-medium">Fonte</th>
                <th className="px-2 py-2 font-medium">Potencial</th>
                <th className="px-2 py-2 font-medium">Criada em</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                  <td className="px-2 py-3">
                    <p className="font-medium text-paper">{l.name}</p>
                    <p className="text-[11px] text-muted">{l.company || "—"}</p>
                  </td>
                  <td className="px-2 py-3"><Pill tone="muted">{l.source}</Pill></td>
                  <td className="px-2 py-3 font-medium text-paper">{l.potential.toLocaleString("pt-PT")} MT</td>
                  <td className="px-2 py-3 text-muted">{l.createdAt}</td>
                  <td className="px-2 py-3"><Pill tone={STATUS_TONE[l.status]}>{l.status}</Pill></td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => openModal(l)} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        onClick={() => {
                          if (window.confirm(`Eliminar o lead ${l.name}?`)) {
                            setLeads(leads.filter((x) => x.id !== l.id));
                            notify("ok", "Lead eliminada.");
                          }
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-baseline hover:text-brand"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Editar lead" : "Novo lead"} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Empresa"><input className={inputCls} value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="Telefone"><input className={inputCls} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
          <Field label="Fonte">
            <select className={inputCls} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Potencial (MT)"><input type="number" min="0" className={inputCls} value={draft.potential} onChange={(e) => setDraft({ ...draft, potential: Number(e.target.value) || 0 })} /></Field>
          <Field label="Estado">
            <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CrmLead["status"] })}>
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="qualified">qualified</option>
              <option value="closed">closed</option>
            </select>
          </Field>
        </div>
        <SaveBar onCancel={() => { setCreating(false); setEditing(null); }} onSave={save} />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contacts                                                             */
/* ------------------------------------------------------------------ */

export function ContactsTab({ notify }: { notify: Notify }) {
  const [contacts, setContacts] = useCrmStore(CRM_CONTACTS_KEY, SEED_CONTACTS);
  const [companies] = useCrmStore(CRM_COMPANIES_KEY, SEED_COMPANIES);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CrmContact | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", role: "", companyId: "" });

  function save() {
    if (!draft.name.trim()) return notify("error", "Nome é obrigatório.");
    const companyId = draft.companyId || undefined;
    if (editing) {
      setContacts(contacts.map((c) => (c.id === editing.id ? { ...editing, ...draft, companyId } : c)));
      notify("ok", "Contacto atualizado.");
    } else {
      setContacts([{ ...draft, companyId, id: nextId("CONT", contacts, 10), createdAt: new Date().toLocaleDateString("pt-PT") }, ...contacts]);
      notify("ok", "Contacto criado.");
    }
    setCreating(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title={`Contactos · ${contacts.length}`}
        right={
          <button type="button" onClick={() => { setCreating(true); setDraft({ name: "", email: "", phone: "", role: "", companyId: "" }); }} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Novo contacto
          </button>
        }
      />
      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Nome</th>
                <th className="px-2 py-2 font-medium">Cargo</th>
                <th className="px-2 py-2 font-medium">Empresa</th>
                <th className="px-2 py-2 font-medium">Contacto</th>
                <th className="px-2 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                  <td className="px-2 py-3 font-medium text-paper">{c.name}</td>
                  <td className="px-2 py-3 text-muted">{c.role || "—"}</td>
                  <td className="px-2 py-3">{companies.find((x) => x.id === c.companyId)?.name ?? "—"}</td>
                  <td className="px-2 py-3">
                    <p className="text-xs text-paper">{c.email}</p>
                    <p className="text-[11px] text-muted">{c.phone}</p>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => { setEditing(c); setDraft({ name: c.name, email: c.email, phone: c.phone, role: c.role, companyId: c.companyId ?? "" }); }} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => { if (window.confirm(`Eliminar ${c.name}?`)) { setContacts(contacts.filter((x) => x.id !== c.id)); notify("ok", "Contacto eliminado."); } }} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Editar contacto" : "Novo contacto"} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Cargo"><input className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="Telefone"><input className={inputCls} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
          <Field label="Empresa">
            <select className={inputCls} value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}>
              <option value="">Sem empresa</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <SaveBar onCancel={() => { setCreating(false); setEditing(null); }} onSave={save} />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Companies                                                            */
/* ------------------------------------------------------------------ */

export function CompaniesTab({ notify }: { notify: Notify }) {
  const [companies, setCompanies] = useCrmStore(CRM_COMPANIES_KEY, SEED_COMPANIES);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CrmCompany | null>(null);
  const [draft, setDraft] = useState({ name: "", industry: "", location: "", website: "", email: "", phone: "", size: "1–10" });

  function save() {
    if (!draft.name.trim()) return notify("error", "Nome é obrigatório.");
    if (editing) {
      setCompanies(companies.map((c) => (c.id === editing.id ? { ...editing, ...draft } : c)));
      notify("ok", "Empresa atualizada.");
    } else {
      setCompanies([{ ...draft, id: nextId("COMP", companies, 10) }, ...companies]);
      notify("ok", "Empresa criada.");
    }
    setCreating(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title={`Empresas · ${companies.length}`}
        right={
          <button type="button" onClick={() => { setCreating(true); setDraft({ name: "", industry: "", location: "", website: "", email: "", phone: "", size: "1–10" }); }} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Nova empresa
          </button>
        }
      />
      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Empresa</th>
                <th className="px-2 py-2 font-medium">Setor</th>
                <th className="px-2 py-2 font-medium">Local</th>
                <th className="px-2 py-2 font-medium">Website</th>
                <th className="px-2 py-2 font-medium">Contacto</th>
                <th className="px-2 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                  <td className="px-2 py-3">
                    <p className="font-medium text-paper">{c.name}</p>
                    <p className="text-[11px] text-muted">~{c.size}</p>
                  </td>
                  <td className="px-2 py-3"><Pill tone="muted">{c.industry}</Pill></td>
                  <td className="px-2 py-3 text-muted">{c.location}</td>
                  <td className="px-2 py-3 text-muted">{c.website}</td>
                  <td className="px-2 py-3">
                    <p className="text-xs text-paper">{c.email}</p>
                    <p className="text-[11px] text-muted">{c.phone}</p>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => { setEditing(c); setDraft({ name: c.name, industry: c.industry, location: c.location, website: c.website, email: c.email, phone: c.phone, size: c.size }); }} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => { if (window.confirm(`Eliminar ${c.name}?`)) { setCompanies(companies.filter((x) => x.id !== c.id)); notify("ok", "Empresa eliminada."); } }} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Editar empresa" : "Nova empresa"} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Setor"><input className={inputCls} value={draft.industry} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} /></Field>
          <Field label="Localização"><input className={inputCls} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></Field>
          <Field label="Website"><input className={inputCls} value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="Telefone"><input className={inputCls} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
          <Field label="Dimensão">
            <select className={inputCls} value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })}>
              {["1–10", "10–50", "50–200", "+200"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <SaveBar onCancel={() => { setCreating(false); setEditing(null); }} onSave={save} />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Opportunities                                                        */
/* ------------------------------------------------------------------ */

export function OpportunitiesTab({ notify }: { notify: Notify }) {
  const [opportunities, setOpportunities] = useCrmStore(CRM_OPPORTUNITIES_KEY, SEED_OPPORTUNITIES);
  const companies = loadStore(CRM_COMPANIES_KEY, SEED_COMPANIES);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CrmOpportunity | null>(null);
  const [draft, setDraft] = useState({ title: "", companyId: "", stage: "lead" as CrmStageId, value: 0, probability: 20, expectedClose: "", owner: "IDesign" });

  function save() {
    if (!draft.title.trim()) return notify("error", "Título é obrigatório.");
    if (editing) {
      setOpportunities(opportunities.map((o) => (o.id === editing.id ? { ...editing, ...draft, probability: Math.max(0, Math.min(100, Number(draft.probability) || 0)) } : o)));
      notify("ok", "Oportunidade atualizada.");
    } else {
      setOpportunities([
        { ...draft, tags: [], id: nextId("OPP", opportunities, 3000), stage: draft.stage, value: Number(draft.value) || 0, probability: Math.max(0, Math.min(100, Number(draft.probability) || 0)) },
        ...opportunities,
      ]);
      notify("ok", "Oportunidade criada.");
    }
    setCreating(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title={`Oportunidades · ${opportunities.length}`}
        right={
          <button type="button" onClick={() => { setCreating(true); setDraft({ title: "", companyId: "", stage: "lead", value: 0, probability: 20, expectedClose: "", owner: "IDesign" }); }} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Nova oportunidade
          </button>
        }
      />
      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Oportunidade</th>
                <th className="px-2 py-2 font-medium">Empresa</th>
                <th className="px-2 py-2 font-medium">Etapa</th>
                <th className="px-2 py-2 font-medium">Valor</th>
                <th className="px-2 py-2 font-medium">Prob.</th>
                <th className="px-2 py-2 font-medium">Fecho</th>
                <th className="px-2 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                  <td className="px-2 py-3 font-medium text-paper">{o.title}</td>
                  <td className="px-2 py-3 text-muted">{companies.find((c) => c.id === o.companyId)?.name ?? "—"}</td>
                  <td className="px-2 py-3"><Pill tone={STAGE_TONE[o.stage]}>{STAGE_LABEL[o.stage]}</Pill></td>
                  <td className="px-2 py-3 font-medium text-paper">{o.value.toLocaleString("pt-PT")} MT</td>
                  <td className="px-2 py-3 text-muted">{o.probability}%</td>
                  <td className="px-2 py-3 text-muted">{o.expectedClose || "—"}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => { setEditing(o); setDraft({ title: o.title, companyId: o.companyId ?? "", stage: o.stage, value: o.value, probability: o.probability, expectedClose: o.expectedClose, owner: o.owner }); }} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => { if (window.confirm(`Eliminar a oportunidade ${o.title}?`)) { setOpportunities(opportunities.filter((x) => x.id !== o.id)); notify("ok", "Oportunidade eliminada."); } }} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Editar oportunidade" : "Nova oportunidade"} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Título"><input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Empresa">
            <select className={inputCls} value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}>
              <option value="">Sem empresa</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Etapa">
            <select className={inputCls} value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as CrmStageId })}>
              {CRM_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Valor (MT)"><input type="number" min="0" className={inputCls} value={draft.value} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) || 0 })} /></Field>
          <Field label="Probabilidade (%)"><input type="number" min="0" max="100" className={inputCls} value={draft.probability} onChange={(e) => setDraft({ ...draft, probability: Number(e.target.value) || 0 })} /></Field>
          <Field label="Fecho previsto"><input className={inputCls} value={draft.expectedClose} onChange={(e) => setDraft({ ...draft, expectedClose: e.target.value })} /></Field>
        </div>
        <SaveBar onCancel={() => { setCreating(false); setEditing(null); }} onSave={save} />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proposals                                                            */
/* ------------------------------------------------------------------ */

export function ProposalsTab({ notify }: { notify: Notify }) {
  const [proposals, setProposals] = useCrmStore(CRM_PROPOSALS_KEY, SEED_PROPOSALS);
  const companies = loadStore(CRM_COMPANIES_KEY, SEED_COMPANIES);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CrmProposal | null>(null);
  const [draft, setDraft] = useState({ title: "", companyId: "", value: 0, status: "draft" as CrmProposal["status"], sentAt: "" });

  function save() {
    if (!draft.title.trim()) return notify("error", "Título é obrigatório.");
    if (editing) {
      setProposals(proposals.map((p) => (p.id === editing.id ? { ...editing, ...draft } : p)));
      notify("ok", "Proposta atualizada.");
    } else {
      setProposals([{ ...draft, id: nextId("PROP", proposals, 4000), value: Number(draft.value) || 0 }, ...proposals]);
      notify("ok", "Proposta criada.");
    }
    setCreating(false);
    setEditing(null);
  }

  const STATUS_TONE = { draft: "muted", sent: "warn", accepted: "ok", rejected: "brand" } as const;

  return (
    <div className="space-y-4">
      <SectionHead
        title={`Propostas · ${proposals.length}`}
        right={
          <button type="button" onClick={() => { setCreating(true); setDraft({ title: "", companyId: "", value: 0, status: "draft", sentAt: "" }); }} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Nova proposta
          </button>
        }
      />
      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Proposta</th>
                <th className="px-2 py-2 font-medium">Empresa</th>
                <th className="px-2 py-2 font-medium">Valor</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 font-medium">Enviada em</th>
                <th className="px-2 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                  <td className="px-2 py-3 font-medium text-paper">{p.title}</td>
                  <td className="px-2 py-3 text-muted">{companies.find((c) => c.id === p.companyId)?.name ?? "—"}</td>
                  <td className="px-2 py-3 font-medium text-paper">{p.value.toLocaleString("pt-PT")} MT</td>
                  <td className="px-2 py-3"><Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill></td>
                  <td className="px-2 py-3 text-muted">{p.sentAt}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => { setEditing(p); setDraft({ title: p.title, companyId: p.companyId ?? "", value: p.value, status: p.status, sentAt: p.sentAt }); }} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => { if (window.confirm(`Eliminar a proposta ${p.title}?`)) { setProposals(proposals.filter((x) => x.id !== p.id)); notify("ok", "Proposta eliminada."); } }} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Editar proposta" : "Nova proposta"} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Título"><input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Empresa">
            <select className={inputCls} value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}>
              <option value="">Sem empresa</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Valor (MT)"><input type="number" min="0" className={inputCls} value={draft.value} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) || 0 })} /></Field>
          <Field label="Estado">
            <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CrmProposal["status"] })}>
              <option value="draft">draft</option>
              <option value="sent">sent</option>
              <option value="accepted">accepted</option>
              <option value="rejected">rejected</option>
            </select>
          </Field>
          <Field label="Enviada em"><input className={inputCls} value={draft.sentAt} onChange={(e) => setDraft({ ...draft, sentAt: e.target.value })} /></Field>
        </div>
        <SaveBar onCancel={() => { setCreating(false); setEditing(null); }} onSave={save} />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Projects                                                             */
/* ------------------------------------------------------------------ */

export function ProjectsTab({ notify }: { notify: Notify }) {
  const [projects, setProjects] = useCrmStore(CRM_PROJECTS_KEY, SEED_CRM_PROJECTS);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CrmProject | null>(null);
  const [draft, setDraft] = useState({ title: "", client: "", service: "", value: 0, status: "onboarding" as CrmProject["status"], progress: 0, start: "" });

  function save() {
    if (!draft.title.trim()) return notify("error", "Título é obrigatório.");
    if (editing) {
      setProjects(projects.map((p) => (p.id === editing.id ? { ...editing, ...draft } : p)));
      notify("ok", "Projeto atualizado.");
    } else {
      setProjects([{ ...draft, id: nextId("CRM-PRJ", projects, 500), value: Number(draft.value) || 0, progress: Math.max(0, Math.min(100, Number(draft.progress) || 0)) }, ...projects]);
      notify("ok", "Projeto criado.");
    }
    setCreating(false);
    setEditing(null);
  }

  const STATUS_TONE = { onboarding: "brand", active: "ok", paused: "warn", completed: "muted" } as const;

  return (
    <div className="space-y-4">
      <SectionHead
        title={`Projetos · ${projects.length}`}
        right={
          <button type="button" onClick={() => { setCreating(true); setDraft({ title: "", client: "", service: "", value: 0, status: "onboarding", progress: 0, start: "" }); }} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Novo projeto
          </button>
        }
      />
      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2 font-medium">Projeto</th>
                <th className="px-2 py-2 font-medium">Cliente</th>
                <th className="px-2 py-2 font-medium">Serviço</th>
                <th className="px-2 py-2 font-medium">Valor</th>
                <th className="px-2 py-2 font-medium">Progresso</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                  <td className="px-2 py-3 font-medium text-paper">{p.title}</td>
                  <td className="px-2 py-3 text-muted">{p.client}</td>
                  <td className="px-2 py-3"><Pill tone="muted">{p.service}</Pill></td>
                  <td className="px-2 py-3 font-medium text-paper">{p.value.toLocaleString("pt-PT")} MT</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-3"><Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill></td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => { setEditing(p); setDraft({ title: p.title, client: p.client, service: p.service, value: p.value, status: p.status, progress: p.progress, start: p.start }); }} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => { if (window.confirm(`Eliminar o projeto ${p.title}?`)) { setProjects(projects.filter((x) => x.id !== p.id)); notify("ok", "Projeto eliminado."); } }} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Editar projeto" : "Novo projeto"} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Título"><input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Cliente"><input className={inputCls} value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} /></Field>
          <Field label="Serviço"><input className={inputCls} value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.target.value })} /></Field>
          <Field label="Valor (MT)"><input type="number" min="0" className={inputCls} value={draft.value} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) || 0 })} /></Field>
          <Field label="Progresso (%)"><input type="number" min="0" max="100" className={inputCls} value={draft.progress} onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) || 0 })} /></Field>
          <Field label="Início"><input className={inputCls} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></Field>
          <Field label="Estado">
            <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CrmProject["status"] })}>
              <option value="onboarding">onboarding</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </select>
          </Field>
        </div>
        <SaveBar onCancel={() => { setCreating(false); setEditing(null); }} onSave={save} />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity (communication + notes)                                     */
/* ------------------------------------------------------------------ */

export function ActivityTab({ notify }: { notify: Notify }) {
  const [communications, setCommunications] = useCrmStore(CRM_COMMUNICATIONS_KEY, SEED_COMMUNICATIONS);
  const [notes, setNotes] = useCrmStore(CRM_NOTES_KEY, SEED_NOTES);
  const companies = loadStore(CRM_COMPANIES_KEY, SEED_COMPANIES);

  const [adding, setAdding] = useState(false);
  const [commDraft, setCommDraft] = useState({ type: "call" as CrmCommunication["type"], direction: "out" as CrmCommunication["direction"], subject: "", summary: "", companyId: "" });
  const [addingNote, setAddingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState({ text: "" });

  function saveComm() {
    if (!commDraft.subject.trim() && !commDraft.summary.trim()) return notify("error", "Falta assunto ou resumo.");
    setCommunications([
      {
        ...commDraft,
        companyId: commDraft.companyId || undefined,
        date: new Date().toLocaleDateString("pt-PT"),
        id: nextId("COMM", communications, 600),
      },
      ...communications,
    ]);
    setAdding(false);
    setCommDraft({ type: "call", direction: "out", subject: "", summary: "", companyId: "" });
    notify("ok", "Comunicação registada.");
  }

  function saveNote() {
    if (!noteDraft.text.trim()) return notify("error", "Escreve o conteúdo da nota.");
    setNotes([{ text: noteDraft.text, createdAt: new Date().toLocaleDateString("pt-PT"), author: "IDesign", id: nextId("NOTE", notes, 700) }, ...notes]);
    setAddingNote(false);
    setNoteDraft({ text: "" });
    notify("ok", "Nota registada.");
  }

  const TYPE_ICON = { call: "📞", email: "✉️", meeting: "🤝", whatsapp: "💬" };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className={card}>
        <SectionHead
          title={`Comunicações · ${communications.length}`}
          right={
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
              <Plus className="h-4 w-4" /> Registar
            </button>
          }
        />
        {communications.length === 0 ? (
          <Empty text="Sem comunicações." />
        ) : (
          <div className="space-y-2">
            {communications.map((c) => (
              <div key={c.id} className="rounded-lg border border-line bg-ink p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{TYPE_ICON[c.type]}</span>
                    <span className="text-xs font-medium text-paper">{c.direction === "in" ? "Entrada" : "Saída"}</span>
                    <Pill tone={c.type === "meeting" ? "brand" : "muted"}>{c.type}</Pill>
                    <span className="text-xs text-muted">{c.date}</span>
                  </div>
                  <span className="text-xs text-muted">{companies.find((x) => x.id === c.companyId)?.name ?? ""}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-paper">{c.subject || "Sem assunto"}</p>
                <p className="text-xs text-muted">{c.summary}</p>
              </div>
            ))}
          </div>
        )}

        <Modal open={adding} onClose={() => setAdding(false)} title="Nova comunicação" wide>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className={inputCls} value={commDraft.type} onChange={(e) => setCommDraft({ ...commDraft, type: e.target.value as CrmCommunication["type"] })}>
                {COMMUNICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Direção">
              <select className={inputCls} value={commDraft.direction} onChange={(e) => setCommDraft({ ...commDraft, direction: e.target.value as CrmCommunication["direction"] })}>
                <option value="out">Saída</option>
                <option value="in">Entrada</option>
              </select>
            </Field>
            <Field label="Empresa">
              <select className={inputCls} value={commDraft.companyId} onChange={(e) => setCommDraft({ ...commDraft, companyId: e.target.value })}>
                <option value="">Sem empresa</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Assunto"><input className={inputCls} value={commDraft.subject} onChange={(e) => setCommDraft({ ...commDraft, subject: e.target.value })} /></Field>
            <Field label="Resumo">
              <textarea className={inputCls} rows={3} value={commDraft.summary} onChange={(e) => setCommDraft({ ...commDraft, summary: e.target.value })} />
            </Field>
          </div>
          <SaveBar onCancel={() => setAdding(false)} onSave={saveComm} />
        </Modal>
      </div>

      <div className={card}>
        <SectionHead
          title={`Notas · ${notes.length}`}
          right={
            <button type="button" onClick={() => setAddingNote(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
              <StickyNote className="h-4 w-4" /> Nova nota
            </button>
          }
        />
        {notes.length === 0 ? (
          <Empty text="Sem notas." />
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-line bg-ink p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">{n.author} · {n.createdAt}</span>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => {
                      if (window.confirm("Eliminar nota?")) {
                        setNotes(notes.filter((x) => x.id !== n.id));
                        notify("ok", "Nota eliminada.");
                      }
                    }}
                    className="rounded p-1 text-muted transition-colors hover:text-brand"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-sm text-paper">{n.text}</p>
              </div>
            ))}
          </div>
        )}

        <Modal open={addingNote} onClose={() => setAddingNote(false)} title="Nova nota">
          <Field label="Conteúdo">
            <textarea className={inputCls} rows={4} value={noteDraft.text} onChange={(e) => setNoteDraft({ text: e.target.value })} />
          </Field>
          <SaveBar onCancel={() => setAddingNote(false)} onSave={saveNote} />
        </Modal>
      </div>
    </div>
  );
}