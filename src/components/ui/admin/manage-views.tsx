"use client";
import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Ban,
  CheckCircle2,
  Save,
  Users,
  ShoppingCart,
  CreditCard,
  Globe,
  Server,
  FolderKanban,
  LifeBuoy,
  Package,
  Tags,
  Layers,
  Repeat,
  Rocket,
  ArrowRight,
} from "lucide-react";
import {
  ADMIN_HOSTING_KEY,
  CATALOG_KEY,
  CUSTOMERS_KEY,
  EXTENSIONS_KEY,
  EXPIRY_POOL,
  RELATED_KINDS,
  SEED_ADMIN_HOSTING,
  SEED_CATALOG,
  SEED_CUSTOMERS,
  SEED_EXTENSIONS,
  SERVERS,
  loadStore,
  nextId,
  relatedFor,
  saveStore,
  type AdminCatalog,
  type AdminCoupon,
  type AdminCustomer,
  type AdminExtension,
  type AdminHostingPlanRow,
  type AdminPlan,
  type AdminProduct,
  type RelatedKind,
} from "./manage-stores";
import { card, Empty, Pill, SectionHead, Spinner } from "./views";
import type { Notify } from "./types";

/* ------------------------------------------------------------------ */
/* Shared form primitives                                             */
/* ------------------------------------------------------------------ */

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

const statusTone = (s: string): "ok" | "brand" | "warn" | "muted" => {
  const v = s.toLowerCase();
  if (["ativo", "pago", "resolvido", "concluído", "concluido", "disponível", "disponivel"].some((w) => v.includes(w))) return "ok";
  if (["suspenso", "cancelado", "falhou", "baixa"].some((w) => v.includes(w))) return "muted";
  if (["pendente", "aberto", "em progresso", "alta", "aguarda"].some((w) => v.includes(w))) return "warn";
  return "brand";
};

/* ------------------------------------------------------------------ */
/* 1. Customers                                                       */
/* ------------------------------------------------------------------ */

function CustomerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<AdminCustomer>;
  onSave: (c: AdminCustomer) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AdminCustomer>({
    id: initial.id ?? nextId("CUST", SEED_CUSTOMERS, 100),
    name: initial.name ?? "",
    email: initial.email ?? "",
    phone: initial.phone ?? "",
    company: initial.company ?? "",
    nuit: initial.nuit ?? "",
    status: initial.status ?? "Ativo",
    createdAt: initial.createdAt ?? "Hoje",
  });
  const set = (k: keyof AdminCustomer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome completo"><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
        <Field label="Empresa"><input className={inputCls} value={form.company} onChange={set("company")} /></Field>
        <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Telefone"><input className={inputCls} value={form.phone} onChange={set("phone")} /></Field>
        <Field label="NUIT"><input className={inputCls} value={form.nuit} onChange={set("nuit")} /></Field>
        <Field label="Estado">
          <select className={inputCls} value={form.status} onChange={set("status")}>
            <option>Ativo</option>
            <option>Suspenso</option>
          </select>
        </Field>
      </div>
      <SaveBar onCancel={onCancel} onSave={() => onSave(form)} />
    </div>
  );
}

export function CustomersView({ notify }: { notify: Notify }) {
  const [customers, setCustomers] = useState<AdminCustomer[]>(() => loadStore(CUSTOMERS_KEY, SEED_CUSTOMERS));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [tab, setTab] = useState<RelatedKind>("Pedidos");

  const persist = useCallback((next: AdminCustomer[]) => {
    setCustomers(next);
    saveStore(CUSTOMERS_KEY, next);
  }, []);

  const active = customers.filter((c) => c.status === "Ativo").length;
  const selectedRow = selected ? customers.find((c) => c.id === selected.id) ?? null : null;

  const toggleSuspend = (c: AdminCustomer) => {
    const nextStatus = c.status === "Ativo" ? "Suspenso" : "Ativo";
    persist(customers.map((x) => (x.id === c.id ? { ...x, status: nextStatus } : x)));
    notify("ok", `${c.name} ${nextStatus === "Ativo" ? "reativado" : "suspenso"}.`);
  };

  const removeCustomer = (c: AdminCustomer) => {
    if (!window.confirm(`Eliminar o cliente ${c.name}?`)) return;
    persist(customers.filter((x) => x.id !== c.id));
    if (selected?.id === c.id) setSelected(null);
    notify("ok", "Cliente eliminado.");
  };

  return (
    <div className="space-y-6">
      <SectionHead
        title={`Clientes · ${customers.length}`}
        desc={`${active} ativos · ${customers.length - active} suspensos`}
        right={
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
        }
      />

      {customers.length === 0 ? (
        <div className={card}><Empty text="Sem clientes." /></div>
      ) : (
        <div className={`${card} divide-y divide-line`}>
          {customers.map((c) => (
            <motion.div
              key={c.id}
              className="flex flex-wrap items-center gap-3 py-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <button type="button" onClick={() => { setSelected(c); setTab("Pedidos"); }} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-paper">{c.name}</p>
                <p className="truncate text-xs text-muted">{c.company} · {c.email} · {c.phone}</p>
              </button>
              <Pill tone={c.status === "Ativo" ? "ok" : "muted"}>{c.status}</Pill>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setEditing(c)} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSuspend(c)}
                  title={c.status === "Ativo" ? "Suspender" : "Reativar"}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand`}
                >
                  {c.status === "Ativo" ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => removeCustomer(c)} title="Eliminar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo cliente">
        <CustomerForm initial={{}} onCancel={() => setCreating(false)} onSave={(c) => {
          persist([...customers, c]);
          setCreating(false);
          notify("ok", "Cliente criado.");
        }} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar cliente">
        {editing && (
          <CustomerForm initial={editing} onCancel={() => setEditing(null)} onSave={(c) => {
            persist(customers.map((x) => (x.id === c.id ? c : x)));
            setEditing(null);
            notify("ok", "Cliente atualizado.");
          }} />
        )}
      </Modal>

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedRow && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className={`${card} flex h-full w-full max-w-xl flex-col overflow-hidden rounded-none sm:rounded-l-xl`}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    <h3 className="text-[13.2px] font-semibold text-paper">{selectedRow.name}</h3>
                    <Pill tone={selectedRow.status === "Ativo" ? "ok" : "muted"}>{selectedRow.status}</Pill>
                  </div>
                  <p className="mt-1 text-sm text-muted">{selectedRow.company} · {selectedRow.email} · {selectedRow.phone}</p>
                  <p className="text-xs text-muted">NUIT {selectedRow.nuit || "—"} · Cliente desde {selectedRow.createdAt} · ID {selectedRow.id}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-paper" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {RELATED_KINDS.map((k) => {
                   const Icon = { Pedidos: ShoppingCart, Pagamentos: CreditCard, Domínios: Globe, Hosting: Server, Projetos: FolderKanban, Tickets: LifeBuoy }[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        tab === k ? "bg-brand text-white" : "border border-line bg-surface-2 text-muted hover:text-paper"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {k}
                    </button>
                  );
                })}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {relatedFor(selectedRow, tab).map((row, i) => (
                  <motion.div
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-ink p-3"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(i * 0.04, 0.2) }}
                    style={{ marginBottom: i < relatedFor(selectedRow, tab).length - 1 ? 8 : 0 }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-paper">{row.title}</p>
                      <p className="truncate text-xs text-muted">{row.meta}</p>
                    </div>
                    <Pill tone={statusTone(row.status)}>{row.status}</Pill>
                    {row.value && <span className="text-sm font-medium text-paper">{row.value}</span>}
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => toggleSuspend(selectedRow)} className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:border-brand hover:text-paper">
                  {selectedRow.status === "Ativo" ? "Suspender cliente" : "Reativar cliente"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared catalog editor                                              */
/* ------------------------------------------------------------------ */

function CatalogEditor({
  title,
  desc,
  items,
  categories,
  kind,
  onChange,
  notify,
}: {
  title: string;
  desc: string;
  items: AdminProduct[] | AdminPlan[];
  categories: { id: string; name: string }[];
  kind: "product" | "plan";
  onChange: (next: AdminProduct[] | AdminPlan[]) => void;
  notify: Notify;
}) {
  const [editing, setEditing] = useState<AdminProduct | AdminPlan | null>(null);
  const [creating, setCreating] = useState(false);

  const blank = (): AdminProduct | AdminPlan => {
    const base = { category: categories[0]?.id ?? "", price: 0, period: "/ mês", features: [], active: true };
    if (kind === "plan") return { id: nextId("PLN", items, 10), name: "", ...base } as AdminPlan;
    return { id: nextId("ITM", items, 100), name: "", ...base } as AdminProduct;
  };

  const [draft, setDraft] = useState<AdminProduct | AdminPlan | null>(null);
  const [draftFeatures, setDraftFeatures] = useState("");

  const openCreate = () => {
    const b = blank();
    setDraft(b);
    setDraftFeatures("");
    setCreating(true);
  };

  const openEdit = (item: AdminProduct | AdminPlan) => {
    setDraft({ ...item, features: [...item.features] });
    setDraftFeatures(item.features.join(", "));
    setEditing(item);
  };

  const done = (create: boolean) => () => {
    if (!draft) return;
    const features = draftFeatures.split(",").map((s) => s.trim()).filter(Boolean);
    const final = { ...draft, features };
    onChange(create ? [...items, final] : items.map((i) => (i.id === final.id ? final : i)));
    notify("ok", create ? "Item criado." : "Item atualizado.");
    setCreating(false);
    setEditing(null);
    setDraft(null);
  };

  return (
    <div className={`${card}`}>
      <SectionHead
        title={title}
        desc={desc}
        right={
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Novo
          </button>
        }
      />
      {items.length === 0 ? (
        <Empty text="Sem itens." />
      ) : (
        <div className="divide-y divide-line">
          {items.map((item, i) => (
            <motion.div key={item.id} className="flex flex-wrap items-center gap-3 py-3" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.2) }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-paper">{item.name}</p>
                  {!item.active && <Pill tone="muted">inativo</Pill>}
                </div>
                <p className="truncate text-xs text-muted">
                  {categories.find((c) => c.id === item.category)?.name ?? "—"} · {item.features.length} funcionalidades
                </p>
              </div>
              <span className="text-sm font-bold text-paper">{item.price.toLocaleString("pt-PT")} MT <span className="text-xs font-normal text-muted">{item.period}</span></span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => openEdit(item)} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={item.active ? "Desativar" : "Ativar"}
                  onClick={() => onChange(items.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x)))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  {item.active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => {
                    if (window.confirm(`Eliminar "${item.name}"?`)) {
                      onChange(items.filter((x) => x.id !== item.id));
                      notify("ok", "Item eliminado.");
                    }
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={creating ? "Novo item" : "Editar item"}>
        {draft && (
          <div className="grid grid-cols-1 gap-3">
            <Field label="Nome"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Categoria">
                <select className={inputCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Periodicidade">
                <select className={inputCls} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })}>
                  <option>pagamento único</option>
                  <option>/ mês</option>
                  <option>/ ano</option>
                </select>
              </Field>
            </div>
            <Field label="Preço (MT)">
              <input className={inputCls} type="number" value={draft.price === 0 ? "" : draft.price} placeholder="0" onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Funcionalidades (separadas por vírgula)">
              <textarea className={inputCls} rows={3} value={draftFeatures} onChange={(e) => setDraftFeatures(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-paper">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-[#bef264]" />
              Ativo / disponível no site
            </label>
            <SaveBar onCancel={() => { setCreating(false); setEditing(null); }} onSave={done(creating)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Products                                                        */
/* ------------------------------------------------------------------ */

export function ProductsView({ notify }: { notify: Notify }) {
  const [catalog, setCatalog] = useState<AdminCatalog>(() => loadStore(CATALOG_KEY, SEED_CATALOG));
  const [tab, setTab] = useState<"Produtos" | "Planos" | "Categorias" | "Cupões">("Produtos");
  const [catDraft, setCatDraft] = useState<string>("");

  const persist = useCallback((next: AdminCatalog) => {
    setCatalog(next);
    saveStore(CATALOG_KEY, next);
  }, []);

  const addCategory = () => {
    const name = catDraft.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (catalog.categories.some((c) => c.id === id)) return;
    persist({ ...catalog, categories: [...catalog.categories, { id, name }] });
    setCatDraft("");
    notify("ok", "Categoria criada.");
  };

  const addCoupon = () => {
    const code = (`CPN${catalog.coupons.length + 1}`).toUpperCase();
    const draft: AdminCoupon = { id: nextId("CPN", catalog.coupons, 20), code: "", percent: 10, active: true };
    setCouponDraft(draft);
    setCouponNewCode(code);
  };

  const [couponDraft, setCouponDraft] = useState<AdminCoupon | null>(null);
  const [couponNewCode, setCouponNewCode] = useState("");

  const saveCoupon = (create: boolean) => {
    if (!couponDraft) return;
    const final = { ...couponDraft, code: (couponNewCode || couponDraft.code).trim().toUpperCase() };
    persist({
      ...catalog,
      coupons: create ? [...catalog.coupons, final] : catalog.coupons.map((c) => (c.id === couponDraft.id ? final : c)),
    });
    notify("ok", create ? "Cupão criado." : "Cupão atualizado.");
    setCouponDraft(null);
  };

  const tabs = [
    { id: "Produtos" as const, label: "Produtos", Icon: Package },
    { id: "Planos" as const, label: "Planos", Icon: Layers },
    { id: "Categorias" as const, label: "Categorias", Icon: Tags },
    { id: "Cupões" as const, label: "Cupões & Descontos", Icon: LifeBuoy },
  ];

  const couponsAvailable = useMemo(() => catalog.coupons.filter((c) => c.active).length, [catalog.coupons]);

  return (
    <div className="space-y-4">
      <SectionHead title="Produtos" desc="Catálogo, categorias, planos, cupões e descontos — sem mexer no código." />

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-brand text-white" : "border border-line bg-surface-2 text-muted hover:text-paper"
            }`}
          >
            <t.Icon className="h-4 w-4" /> {t.label}
            {t.id === "Cupões" && couponsAvailable > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs">{couponsAvailable}</span>}
          </button>
        ))}
      </div>

      {tab === "Produtos" && (
        <CatalogEditor
          title={`Produtos · ${catalog.products.length}`}
          desc="Preços e funcionalidades dos produtos à venda."
          items={catalog.products}
          categories={catalog.categories}
          kind="product"
          onChange={(items) => persist({ ...catalog, products: items as AdminProduct[] })}
          notify={notify}
        />
      )}

      {tab === "Planos" && (
        <CatalogEditor
          title={`Planos · ${catalog.plans.length}`}
          desc="Tiers de preço apresentados no pricing."
          items={catalog.plans}
          categories={catalog.categories}
          kind="plan"
          onChange={(items) => persist({ ...catalog, plans: items as AdminPlan[] })}
          notify={notify}
        />
      )}

      {tab === "Categorias" && (
        <div className={card}>
          <SectionHead title="Categorias" desc="Agrupam produtos e planos no catálogo." />
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              className={`${inputCls} max-w-xs`}
              placeholder="Nome da nova categoria"
              value={catDraft}
              onChange={(e) => setCatDraft(e.target.value)}
            />
            <button type="button" onClick={addCategory} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
              <Plus className="h-4 w-4" /> Criar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {catalog.categories.map((cat) => (
              <div key={cat.id} className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-1.5 text-sm text-paper">
                <span>{cat.name}</span>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => {
                    if (window.confirm(`Eliminar a categoria "${cat.name}"?`)) {
                      persist({ ...catalog, categories: catalog.categories.filter((c) => c.id !== cat.id) });
                      notify("ok", "Categoria eliminada.");
                    }
                  }}
                  className="text-muted transition-colors hover:text-brand"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Cupões" && (
        <div className={card}>
          <SectionHead
            title={`Cupões & Descontos · ${catalog.coupons.length}`}
            desc="Códigos de desconto com percentagem aplicada no checkout."
            right={
              <button type="button" onClick={addCoupon} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
                <Plus className="h-4 w-4" /> Novo cupão
              </button>
            }
          />
          {catalog.coupons.length === 0 ? (
            <Empty text="Sem cupões." />
          ) : (
            <div className="divide-y divide-line">
              {catalog.coupons.map((cp) => (
                <div key={cp.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-paper">{cp.code}</p>
                    <p className="text-xs text-muted">-{cp.percent}%</p>
                  </div>
                  <Pill tone={cp.active ? "ok" : "muted"}>{cp.active ? "ativo" : "inativo"}</Pill>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => { setCouponDraft({ ...cp }); setCouponNewCode(cp.code); }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => persist({ ...catalog, coupons: catalog.coupons.map((c) => (c.id === cp.id ? { ...c, active: !c.active } : c)) })}
                      title={cp.active ? "Desativar" : "Ativar"}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
                    >
                      {cp.active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => {
                        if (window.confirm(`Eliminar o cupão ${cp.code}?`)) {
                          persist({ ...catalog, coupons: catalog.coupons.filter((c) => c.id !== cp.id) });
                          notify("ok", "Cupão eliminado.");
                        }
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={!!couponDraft} onClose={() => setCouponDraft(null)} title={couponDraft && catalog.coupons.some((c) => c.id === couponDraft.id) ? "Editar cupão" : "Novo cupão"}>
        {couponDraft && (
          <div className="grid grid-cols-1 gap-3">
            <Field label="Código"><input className={inputCls} value={couponNewCode} onChange={(e) => setCouponNewCode(e.target.value)} /></Field>
            <Field label="Desconto (%)"><input className={inputCls} type="number" value={couponDraft.percent} onChange={(e) => setCouponDraft({ ...couponDraft, percent: Number(e.target.value) || 0 })} /></Field>
            <label className="flex items-center gap-2 text-sm text-paper">
              <input type="checkbox" checked={couponDraft.active} onChange={(e) => setCouponDraft({ ...couponDraft, active: e.target.checked })} className="accent-[#bef264]" />
              Ativo
            </label>
            <SaveBar onCancel={() => setCouponDraft(null)} onSave={() => saveCoupon(!catalog.coupons.some((c) => c.id === couponDraft.id))} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Domains (extensions)                                            */
/* ------------------------------------------------------------------ */

export function DomainsAdminView({ notify }: { notify: Notify }) {
  const [extensions, setExtensions] = useState<AdminExtension[]>(() => loadStore(EXTENSIONS_KEY, SEED_EXTENSIONS));
  const persist = useCallback((next: AdminExtension[]) => {
    setExtensions(next);
    saveStore(EXTENSIONS_KEY, next);
  }, []);
  const available = extensions.filter((e) => e.available).length;
  const registered = extensions.filter((e) => !e.available).length;

  return (
    <div className="space-y-6">
      <SectionHead
        title={`Extensões de domínio · ${extensions.length}`}
        desc={`${available} disponíveis · ${registered} registadas/suspensas`}
      />

      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {extensions.map((ext, i) => (
            <motion.div
              key={ext.extension}
              className={`mb-2 rounded-xl border ${ext.suspended ? "border-brand/30 bg-brand/5" : "border-line bg-surface"} p-4 shadow-sm`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.3) }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-[160px] items-center gap-2">
                  <Globe className="h-4 w-4 text-brand" />
                  <div>
                    <p className="text-sm font-semibold text-paper">{ext.extension}</p>
                    <p className="text-xs text-muted">expira {ext.expires}</p>
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap items-end gap-3">
                  {(
                    [
                      { label: "Registo", key: "register" as const },
                      { label: "Renovação", key: "renewal" as const },
                      { label: "Transfer", key: "transfer" as const },
                    ]
                  ).map((p) => (
                    <label key={p.key} className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{p.label}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">MT</span>
                        <input
                          className="w-24 rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-paper outline-none focus:border-brand"
                          type="number"
                          value={ext[p.key]}
                          onChange={(e) => persist(extensions.map((x) => (x.extension === ext.extension ? { ...x, [p.key]: Number(e.target.value) || 0 } : x)))}
                        />
                      </div>
                    </label>
                  ))}

                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <Pill tone={ext.suspended ? "muted" : "ok"}>{ext.suspended ? "suspensa" : "ativa"}</Pill>
                    <Pill tone={ext.available ? "ok" : "brand"}>{ext.available ? "disponível" : "registada"}</Pill>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => persist(extensions.map((x) => (x.extension === ext.extension ? { ...x, available: !x.available } : x)))}
                    title={ext.available ? "Marcar como registada" : "Marcar como disponível"}
                    className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-brand"
                  >
                    {ext.available ? "Registar" : "Libertar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => persist(extensions.map((x) => (x.extension === ext.extension ? { ...x, suspended: !x.suspended } : x)))}
                    title={ext.suspended ? "Reativar" : "Suspender"}
                    className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-brand"
                  >
                    {ext.suspended ? "Reativar" : "Suspender"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextCount = ext.renewCount + 1;
                      persist(extensions.map((x) => (x.extension === ext.extension ? { ...x, renewCount: nextCount, expires: EXPIRY_POOL[nextCount % EXPIRY_POOL.length] } : x)));
                      notify("ok", `${ext.extension} renovado até ${EXPIRY_POOL[nextCount % EXPIRY_POOL.length]}.`);
                    }}
                    title="Renovar (+1 ano)"
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-brand"
                  >
                    <Repeat className="h-3.5 w-3.5" /> Renovar
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-2 max-w-3xl">
        <div className={card}>
          <SectionHead title="Estado do registo" desc="Como é interpretada cada extensão." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Disponíveis</p>
              <p className="text-[14.4px] font-bold text-ok">{available}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Registadas</p>
              <p className="text-[14.4px] font-bold text-paper">{registered}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Suspensas</p>
              <p className="text-[14.4px] font-bold text-brand">{extensions.filter((e) => e.suspended).length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Hosting plans                                                   */
/* ------------------------------------------------------------------ */

function HostingPlanForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: AdminHostingPlanRow;
  onSave: (p: AdminHostingPlanRow) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AdminHostingPlanRow>({ ...initial, ...(initial.id ? {} : {}) });
  const set = (k: keyof AdminHostingPlanRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome do plano"><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
        <Field label="Servidor">
          <select className={inputCls} value={form.server} onChange={set("server")}>
            {SERVERS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Armazenamento"><input className={inputCls} value={form.storage} onChange={set("storage")} /></Field>
        <Field label="Websites"><input className={inputCls} value={form.websites} onChange={set("websites")} /></Field>
        <Field label="Emails"><input className={inputCls} value={form.emails} onChange={set("emails")} /></Field>
        <Field label="Bases de dados"><input className={inputCls} value={form.databases} onChange={set("databases")} /></Field>
        <Field label="Preço mensal (MT)"><input className={inputCls} type="number" value={form.monthly || ""} onChange={set("monthly")} /></Field>
        <Field label="Preço anual (MT)"><input className={inputCls} type="number" value={form.annual || ""} onChange={set("annual")} /></Field>
        <Field label="Ciclo de faturação">
          <select className={inputCls} value={form.cycle} onChange={set("cycle")}>
            <option value="monthly">Mensal</option>
            <option value="annual">Anual</option>
          </select>
        </Field>
        <Field label="Estado">
          <select className={inputCls} value={form.status} onChange={set("status")}>
            <option>Ativo</option>
            <option>Suspenso</option>
          </select>
        </Field>
      </div>
      <SaveBar onCancel={onCancel} onSave={() => onSave(form)} />
    </div>
  );
}

export function HostingAdminView({ notify }: { notify: Notify }) {
  const [plans, setPlans] = useState<AdminHostingPlanRow[]>(() => loadStore(ADMIN_HOSTING_KEY, SEED_ADMIN_HOSTING));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminHostingPlanRow | null>(null);
  const persist = useCallback((next: AdminHostingPlanRow[]) => {
    setPlans(next);
    saveStore(ADMIN_HOSTING_KEY, next);
  }, []);

  return (
    <div className="space-y-6">
      <SectionHead
        title={`Planos de alojamento · ${plans.length}`}
        desc="Recursos, preços, ciclo de faturação, servidor e estado."
        right={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" /> Novo plano
          </button>
        }
      />

      {plans.length === 0 ? (
        <div className={card}><Empty text="Sem planos de alojamento." /></div>
      ) : (
        <div className={card}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Plano</th>
                  <th className="px-2 py-2 font-medium">Servidor</th>
                  <th className="px-2 py-2 font-medium">Recursos</th>
                  <th className="px-2 py-2 font-medium text-right">Mensal</th>
                  <th className="px-2 py-2 font-medium text-right">Anual</th>
                  <th className="px-2 py-2 font-medium">Ciclo</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-ink/40">
                    <td className="px-2 py-3 font-medium text-paper">{p.name}</td>
                    <td className="px-2 py-3"><Pill tone="brand">{p.server}</Pill></td>
                    <td className="px-2 py-3">
                      <p className="text-xs text-paper">{p.storage}</p>
                      <p className="text-[11px] text-muted">{p.websites}{p.websites !== "—" ? " sites" : ""} · {p.emails} emails · {p.databases} BD</p>
                    </td>
                    <td className="px-2 py-3 text-right font-medium text-paper">{p.monthly.toLocaleString("pt-PT")} MT</td>
                    <td className="px-2 py-3 text-right font-medium text-paper">{p.annual.toLocaleString("pt-PT")} MT</td>
                    <td className="px-2 py-3"><Pill tone={p.cycle === "monthly" ? "warn" : "ok"}>{p.cycle === "monthly" ? "mensal" : "anual"}</Pill></td>
                    <td className="px-2 py-3"><Pill tone={p.status === "Ativo" ? "ok" : "muted"}>{p.status}</Pill></td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => setEditing(p)} title="Editar" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => persist(plans.map((x) => (x.id === p.id ? { ...x, status: x.status === "Ativo" ? "Suspenso" : "Ativo" } : x)))}
                          title={p.status === "Ativo" ? "Suspender" : "Reativar"}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
                        >
                          {p.status === "Ativo" ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => {
                            if (window.confirm(`Eliminar o plano "${p.name}"?`)) {
                              persist(plans.filter((x) => x.id !== p.id));
                              notify("ok", "Plano eliminado.");
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
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
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={creating ? "Novo plano" : "Editar plano"} wide>
        {editing ? (
          <HostingPlanForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={(p) => {
              persist(plans.map((x) => (x.id === p.id ? p : x)));
              setEditing(null);
              notify("ok", "Plano atualizado.");
            }}
          />
        ) : (
          creating && (
            <HostingPlanForm
              initial={{
                id: nextId("APL", plans, 10),
                name: "",
                server: "Shared",
                storage: "",
                websites: "1",
                emails: "5",
                databases: "1",
                monthly: 0,
                annual: 0,
                cycle: "annual",
                status: "Ativo",
              }}
              onCancel={() => setCreating(false)}
              onSave={(p) => {
                persist([...plans, p]);
                setCreating(false);
                notify("ok", "Plano criado.");
              }}
            />
          )
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Provisioning                                                       */
/* ------------------------------------------------------------------ */

type ProvisionStepState = "pending" | "running" | "ok" | "skipped" | "error";

type ProvisionStepRow = {
  id: string;
  label: string;
  state: ProvisionStepState;
  detail?: string;
};

type ProvisionFlowResponse = {
  ok: boolean;
  mode: "live" | "simulated";
  provider: string;
  steps: ProvisionStepRow[];
  error?: string;
  data?: Record<string, unknown>;
};

const STEP_TONE: Record<ProvisionStepState, { dot: string; label: string }> = {
  running: { dot: "bg-brand animate-pulse", label: "a processar" },
  ok: { dot: "bg-ok", label: "ok" },
  skipped: { dot: "bg-muted/40", label: "omitido" },
  error: { dot: "bg-brand", label: "erro" },
  pending: { dot: "bg-surface-2", label: "pendente" },
};

function StepTimeline({ steps }: { steps: ProvisionStepRow[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s) => {
        const tone = STEP_TONE[s.state];
        return (
          <li key={s.id} className="flex items-start gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-paper">{s.label}</p>
              {s.detail ? <p className="mt-0.5 break-words text-xs text-muted">{s.detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ProvisioningView({ notify }: { notify: Notify }) {
  const [hosting, setHosting] = useState({
    customerName: "Ana Mondlane",
    customerEmail: "ana.mondlane@example.com",
    domain: "belezamoz.com.mz",
    planName: "Startup",
    username: "",
  });
  const [hostingBusy, setHostingBusy] = useState(false);
  const [hostingResult, setHostingResult] = useState<ProvisionFlowResponse | null>(null);

  const [domain, setDomain] = useState({
    fullDomain: "meunegocio.co.mz",
    years: "1",
    hostingPlan: "Startup",
    customerEmail: "ana.mondlane@example.com",
  });
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainResult, setDomainResult] = useState<ProvisionFlowResponse | null>(null);

  async function runHosting() {
    setHostingBusy(true);
    setHostingResult(null);
    try {
      const res = await fetch("/api/provisioning/hosting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: hosting.customerName,
          customerEmail: hosting.customerEmail,
          domain: hosting.domain,
          planName: hosting.planName,
          username: hosting.username || undefined,
          paymentVerified: true,
        }),
      });
      const json = (await res.json()) as ProvisionFlowResponse;
      setHostingResult(json);
      notify(json.ok ? "ok" : "error", json.ok ? "Fluxo de alojamento concluído." : json.error ?? "Falha no fluxo.");
    } catch {
      notify("error", "Não foi possível contactar a API.");
    } finally {
      setHostingBusy(false);
    }
  }

  async function runDomain() {
    setDomainBusy(true);
    setDomainResult(null);
    try {
      const res = await fetch("/api/provisioning/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullDomain: domain.fullDomain,
          years: Number(domain.years),
          hostingPlan: domain.hostingPlan,
          customerEmail: domain.customerEmail || undefined,
          paymentVerified: true,
        }),
      });
      const json = (await res.json()) as ProvisionFlowResponse;
      setDomainResult(json);
      notify(json.ok ? "ok" : "error", json.ok ? "Fluxo de domínio concluído." : json.error ?? "Falha no fluxo.");
    } catch {
      notify("error", "Não foi possível contactar a API.");
    } finally {
      setDomainBusy(false);
    }
  }

  const hostingData = hostingResult?.data;
  const domainData = domainResult?.data;

  return (
    <div className="space-y-6">
      <SectionHead
        title="Provisioning"
        desc="Executa e visualiza os fluxos de ativação de alojamento e de domínios. Sem provedor configurado corre em modo simulado."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-brand/10 p-2"><Server className="h-5 w-5 text-brand" /></div>
            <div>
              <h3 className="text-[13.2px] font-semibold text-paper">Alojamento — fluxo completo</h3>
              <p className="text-xs text-muted">Pagamento → verificação → pedido → API → conta → credenciais → notificação</p>
            </div>
          </div>

          <div className="space-y-3">
            <Field label="Cliente">
              <input className={inputCls} value={hosting.customerName} onChange={(e) => setHosting({ ...hosting, customerName: e.target.value })} />
            </Field>
            <Field label="Email do cliente">
              <input className={inputCls} value={hosting.customerEmail} onChange={(e) => setHosting({ ...hosting, customerEmail: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Domínio">
                <input className={inputCls} value={hosting.domain} onChange={(e) => setHosting({ ...hosting, domain: e.target.value })} />
              </Field>
              <Field label="Nome de utilizador (opcional)">
                <input className={inputCls} value={hosting.username} onChange={(e) => setHosting({ ...hosting, username: e.target.value })} />
              </Field>
            </div>
            <Field label="Plano">
              <input className={inputCls} value={hosting.planName} onChange={(e) => setHosting({ ...hosting, planName: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between pt-1">
              <Pill tone="brand">{hostingResult ? (hostingResult.mode === "live" ? "provedor real" : "modo simulado") : "aguarda execução"}</Pill>
              <motion.button
                type="button"
                onClick={runHosting}
                disabled={hostingBusy}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                {hostingBusy ? <Spinner /> : <Rocket className="h-4 w-4" />} Executar fluxo
              </motion.button>
            </div>
          </div>

          {hostingResult && (
            <div className="mt-5 space-y-4 border-t border-line pt-4">
              <StepTimeline steps={hostingResult.steps} />
              {hostingResult.ok && hostingData && (
                <div className="rounded-lg bg-surface-2/60 p-3 text-xs">
                  <p className="mb-1 font-medium text-paper">Creenciais geradas (seguras, nunca em texto simples)</p>
                  <p className="text-muted">Conta: <b className="text-paper">{String(hostingData.accountId)}</b> · Utilizador: <b className="text-paper">{String(hostingData.username)}</b></p>
                  <p className="text-muted">Painel: {String(hostingData.panelUrl)}</p>
                  <p className="mt-1 text-muted">Password guardada cifrada: <code className="break-all text-[10px] text-paper">{String((hostingData.passwordEncrypted as Record<string, string> | null | undefined)?.data ?? "n/d").slice(0, 40)}…</code></p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-brand/10 p-2"><Globe className="h-5 w-5 text-brand" /></div>
            <div>
              <h3 className="text-[13.2px] font-semibold text-paper">Domínio — fluxo de registo</h3>
              <p className="text-xs text-muted">Pesquisa → disponibilidade → carrinho → pagamento → registo → DNS → alojamento</p>
            </div>
          </div>

          <div className="space-y-3">
            <Field label="Domínio completo">
              <input className={inputCls} value={domain.fullDomain} onChange={(e) => setDomain({ ...domain, fullDomain: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Anos">
                <select className={inputCls} value={domain.years} onChange={(e) => setDomain({ ...domain, years: e.target.value })}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="5">5</option>
                </select>
              </Field>
              <Field label="Plano hosting">
                <input className={inputCls} value={domain.hostingPlan} onChange={(e) => setDomain({ ...domain, hostingPlan: e.target.value })} />
              </Field>
              <Field label="Email cliente">
                <input className={inputCls} value={domain.customerEmail} onChange={(e) => setDomain({ ...domain, customerEmail: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Pill tone="brand">{domainResult ? (domainResult.mode === "live" ? "registrador real" : "modo simulado") : "aguarda execução"}</Pill>
              <motion.button
                type="button"
                onClick={runDomain}
                disabled={domainBusy}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                {domainBusy ? <Spinner /> : <ArrowRight className="h-4 w-4" />} Executar fluxo
              </motion.button>
            </div>
          </div>

          {domainResult && (
            <div className="mt-5 space-y-4 border-t border-line pt-4">
              <StepTimeline steps={domainResult.steps} />
              {domainResult.ok && domainData && (
                <div className="rounded-lg bg-surface-2/60 p-3 text-xs">
                  <p className="mb-1 font-medium text-paper">Resultado do registo</p>
                  <p className="text-muted">Domínio: <b className="text-paper">{String(domainData.fullDomain)}</b> · {String(domainData.years)} ano(s)</p>
                  <p className="text-muted">Nameservers: {String((domainData.nameservers as string[] | undefined)?.join(", ") ?? "—")}</p>
                  {domainData.registrantId ? <p className="text-muted">Registrant ID: {String(domainData.registrantId)}</p> : null}
                  <p className="mt-1 text-muted">Associado ao plano <b className="text-paper">{String(domainData.hostingPlan)}</b>.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}