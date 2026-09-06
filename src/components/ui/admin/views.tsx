"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  RefreshCw,
  Check,
  X,
  Undo2,
  LogOut,
  ShieldCheck,
  ShieldPlus,
  Sun,
  Moon,
  TrendingUp,
  MessageSquare,
  ShoppingCart,
  Globe,
  Users,
} from "lucide-react";
import type { AdminData, AdminMessage, AdminOrder, AdminDomain, AdminProfile, Notice, Notify } from "./types";
import { useAdminData } from "./use-admin-data";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Actions = ReturnType<typeof useAdminData>["actions"];

/* ------------------------------------------------------------------ */
/* Shared building blocks                                             */
/* ------------------------------------------------------------------ */

const fmtMT = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-PT")} MT`);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-PT");
const card = "rounded-xl border border-line bg-surface p-6 shadow-sm";

function Spinner() {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "brand" | "warn" | "ok" | "muted" }) {
  const tones = {
    brand: "bg-brand text-white",
    warn: "bg-brand/15 text-paper border border-brand/40",
    ok: "bg-ok/10 text-ok",
    muted: "bg-surface-2 text-muted",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
  );
}

function ActionBtn({
  onClick,
  busy,
  disabled,
  tone = "ghost",
  title,
  children,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "ghost" | "ok" | "brand" | "danger";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    ghost: "border border-line bg-surface-2 text-paper hover:bg-ink hover:border-brand",
    ok: "bg-ok/15 text-ok hover:bg-ok/25",
    brand: "bg-brand text-white hover:bg-brand-hover",
    danger: "border border-brand/40 text-brand hover:bg-brand/10",
  };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      whileHover={busy || disabled ? undefined : { scale: 1.03 }}
      whileTap={busy || disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {busy ? <Spinner /> : children}
    </motion.button>
  );
}

function IconBtn({
  onClick,
  busy,
  title,
  children,
}: {
  onClick: () => void;
  busy?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      whileHover={busy ? undefined : { scale: 1.1 }}
      whileTap={busy ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Spinner /> : children}
    </motion.button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted">{text}</p>;
}

function SectionHead({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[10.8px] font-semibold text-paper">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                           */
/* ------------------------------------------------------------------ */

export function OverviewView({ data, go }: { data: AdminData; go: (v: string) => void }) {
  const newMsgs = data.messages.filter((m) => m.status === "new").length;
  const pendingOrders = data.orders.filter((o) => o.status === "pending").length;
  const availableDomains = data.domains.filter((d) => d.status === "available").length;
  const label = "text-sm font-medium text-muted mb-1";
  const num = "text-[14.4px] font-bold text-paper";

  const stats = [
    { icon: MessageSquare, label: "Mensagens", value: data.messages.length, sub: `${newMsgs} novas`, view: "Mensagens" },
    { icon: ShoppingCart, label: "Pedidos de domínio", value: data.orders.length, sub: `${pendingOrders} pendentes`, view: "Pedidos" },
    { icon: Globe, label: "Domínios disponíveis", value: availableDomains, sub: `de ${data.domains.length} no registo`, view: "Domínios" },
    { icon: Users, label: "Utilizadores", value: data.profiles.length, sub: `${data.profiles.filter((p) => p.role === "admin").length} administradores`, view: "Utilizadores" },
  ];

  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.button
            key={s.label}
            type="button"
            onClick={() => go(s.view)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.07, ease: "easeOut" }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`${card} text-left transition-colors hover:border-brand`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-lg bg-brand/10 p-2"><s.icon className="h-5 w-5 text-brand" /></div>
              <TrendingUp className="h-4 w-4 text-ok" />
            </div>
            <h3 className={label}>{s.label}</h3>
            <p className={num}>{s.value}</p>
            <p className="mt-1 text-sm text-muted">{s.sub}</p>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={card}>
            <SectionHead
              title="Mensagens recentes"
              right={<button type="button" onClick={() => go("Mensagens")} className="text-sm font-medium text-brand hover:underline">Ver todas</button>}
            />
            {data.messages.length ? (
              <div className="space-y-2">
                {data.messages.slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => go("Mensagens")}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className={`rounded-lg p-2 ${m.status === "new" ? "bg-brand/10" : "bg-surface-2"}`}>
                      <MessageSquare className={`h-4 w-4 ${m.status === "new" ? "text-brand" : "text-muted"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-paper">{m.name}</p>
                      <p className="truncate text-xs text-muted">{m.service}{m.message ? ` · ${m.message}` : ""}</p>
                    </div>
                    <div className="text-xs text-muted">{fmtDate(m.created_at)}</div>
                  </button>
                ))}
              </div>
            ) : <Empty text="Sem mensagens de contacto." />}
          </div>
        </div>

        <div className="space-y-6">
          <div className={card}>
            <SectionHead title="Últimos pedidos" right={<button type="button" onClick={() => go("Pedidos")} className="text-sm font-medium text-brand hover:underline">Ver todos</button>} />
            {data.orders.length ? (
              <div className="space-y-3">
                {data.orders.slice(0, 5).map((o) => (
                  <button key={o.id} type="button" onClick={() => go("Pedidos")} className="flex w-full items-center justify-between rounded-lg py-1 text-left hover:text-paper">
                    <span className="truncate text-sm text-muted">{o.full_domain}</span>
                    {o.status === "pending"
                      ? <Pill tone="brand">pendente</Pill>
                      : <span className="text-sm font-medium text-paper">{fmtMT(o.price)}</span>}
                  </button>
                ))}
              </div>
            ) : <Empty text="Sem pedidos." />}
          </div>

          <div className={card}>
            <SectionHead title="Utilizadores" right={<button type="button" onClick={() => go("Utilizadores")} className="text-sm font-medium text-brand hover:underline">Ver todos</button>} />
            {data.profiles.length ? (
              <div className="space-y-3">
                {data.profiles.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1">
                    <span className="truncate text-sm text-muted">{p.full_name || "—"}</span>
                    <Pill tone={p.role === "admin" ? "brand" : "muted"}>{p.role}</Pill>
                  </div>
                ))}
              </div>
            ) : <Empty text="Sem utilizadores." />}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                           */
/* ------------------------------------------------------------------ */

export function MessagesView({ messages, actions, isBusy, notify }: {
  messages: AdminMessage[];
  actions: Actions;
  isBusy: (id: string) => boolean;
  notify: Notify;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const newCount = messages.filter((m) => m.status === "new").length;

  const tone = (s: AdminMessage["status"]): "brand" | "warn" | "ok" =>
    s === "new" ? "brand" : s === "in_progress" ? "warn" : "ok";

  async function run(id: string, res: ReturnType<Actions["setMessageStatus"]>, ok: string) {
    const r = await res;
    notify(r.ok ? "ok" : "error", r.ok ? ok : (r as { error: string }).error);
    if (r.ok) setExpanded((e) => (e === id ? null : e));
  }

  return (
    <div className={card}>
      <SectionHead
        title="Mensagens de contacto"
        desc={newCount ? `${newCount} por tratar` : "Tudo tratado."}
      />
      {messages.length === 0 ? (
        <Empty text="Sem mensagens de contacto." />
      ) : (
        <div className="divide-y divide-line">
          {messages.map((m, i) => {
            const open = expanded === m.id;
            return (
              <motion.div
                key={m.id}
                className="py-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setExpanded(open ? null : m.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-paper">{m.name} <span className="text-muted">· {m.email}</span></p>
                    <p className="truncate text-xs text-muted">{m.service} · {fmtDate(m.created_at)}</p>
                  </button>
                  <Pill tone={tone(m.status)}>{m.status.replace("_", " ")}</Pill>
                  <div className="flex items-center gap-1.5">
                    {m.status !== "done" && (
                      <ActionBtn tone="ok" busy={isBusy(m.id)} onClick={() => run(m.id, actions.setMessageStatus(m.id, "done"), "Mensagem concluída.")}>
                        <Check className="h-3.5 w-3.5" /> Concluir
                      </ActionBtn>
                    )}
                    {m.status === "new" && (
                      <ActionBtn busy={isBusy(m.id)} onClick={() => run(m.id, actions.setMessageStatus(m.id, "in_progress"), "Mensagem em progresso.")}>
                        Em progresso
                      </ActionBtn>
                    )}
                    {m.status === "done" && (
                      <ActionBtn busy={isBusy(m.id)} onClick={() => run(m.id, actions.setMessageStatus(m.id, "new"), "Mensagem marcada como nova.")}>
                        <Undo2 className="h-3.5 w-3.5" /> Reabrir
                      </ActionBtn>
                    )}
                    <IconBtn
                      busy={isBusy(m.id)}
                      title="Eliminar"
                      onClick={() => {
                        if (window.confirm(`Eliminar a mensagem de ${m.name}?`)) {
                          actions.deleteMessage(m.id).then((r) =>
                            notify(r.ok ? "ok" : "error", r.ok ? "Mensagem eliminada." : (r as { error: string }).error)
                          );
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {open && m.message && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-lg border border-line bg-ink p-4 text-sm text-paper">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Mensagem</p>
                        {m.message}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export function OrdersView({ orders, actions, isBusy, notify }: {
  orders: AdminOrder[];
  actions: Actions;
  isBusy: (id: string) => boolean;
  notify: Notify;
}) {
  const pending = orders.filter((o) => o.status === "pending").length;
  const tone = (s: AdminOrder["status"]): "brand" | "warn" | "ok" | "muted" =>
    s === "pending" ? "brand" : s === "paid" ? "warn" : s === "registered" ? "ok" : "muted";

  return (
    <div className={card}>
      <SectionHead
        title="Pedidos de domínio"
        desc={pending ? `${pending} aguardam pagamento` : "Sem pedidos pendentes."}
      />
      {orders.length === 0 ? (
        <Empty text="Sem pedidos de domínio." />
      ) : (
        <div className="divide-y divide-line">
          {orders.map((o, i) => (
            <motion.div
              key={o.id}
              className="flex flex-wrap items-center gap-3 py-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-paper">{o.full_domain}</p>
                <p className="truncate text-xs text-muted">{o.name} · {o.email} · {fmtDate(o.created_at)}</p>
              </div>
              <span className="text-sm font-medium text-paper">{fmtMT(o.price)}</span>
              <Pill tone={tone(o.status)}>{o.status}</Pill>
              <div className="flex items-center gap-1.5">
                {o.status === "pending" && (
                  <>
                    <ActionBtn tone="ok" busy={isBusy(o.id)} onClick={() => actions.setOrderStatus(o.id, "paid").then((r) => notify(r.ok ? "ok" : "error", r.ok ? "Pedido marcado como pago." : (r as { error: string }).error))}>
                      <Check className="h-3.5 w-3.5" /> Marcar pago
                    </ActionBtn>
                    <ActionBtn busy={isBusy(o.id)} onClick={() => { if (window.confirm(`Cancelar o pedido de ${o.full_domain}?`)) actions.setOrderStatus(o.id, "cancelled").then((r) => notify(r.ok ? "ok" : "error", r.ok ? "Pedido cancelado." : (r as { error: string }).error)); }}>
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </ActionBtn>
                  </>
                )}
                {o.status === "paid" && (
                  <>
                    <ActionBtn tone="ok" busy={isBusy(o.id)} onClick={() => actions.registerOrder(o.id).then((r) => notify(r.ok ? "ok" : "error", r.ok ? (r.note ?? "Domínio registado.") : r.error))}>
                      <Check className="h-3.5 w-3.5" /> Registar
                    </ActionBtn>
                    <ActionBtn busy={isBusy(o.id)} onClick={() => { if (window.confirm(`Cancelar o pedido de ${o.full_domain}?`)) actions.setOrderStatus(o.id, "cancelled").then((r) => notify(r.ok ? "ok" : "error", r.ok ? "Pedido cancelado." : (r as { error: string }).error)); }}>
                      <X className="h-3.5 w-3.5" />
                    </ActionBtn>
                  </>
                )}
                {o.status === "cancelled" && (
                  <ActionBtn busy={isBusy(o.id)} onClick={() => actions.setOrderStatus(o.id, "pending").then((r) => notify(r.ok ? "ok" : "error", r.ok ? "Pedido reaberto." : (r as { error: string }).error))}>
                    <Undo2 className="h-3.5 w-3.5" /> Reabrir
                  </ActionBtn>
                )}
                <IconBtn
                  busy={isBusy(o.id)}
                  title="Eliminar"
                  onClick={() => {
                    if (window.confirm(`Eliminar o pedido de ${o.full_domain}?`)) {
                      actions.deleteOrder(o.id).then((r) => notify(r.ok ? "ok" : "error", r.ok ? "Pedido eliminado." : (r as { error: string }).error));
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Domains                                                             */
/* ------------------------------------------------------------------ */

export function DomainsView({ domains, actions, isBusy, notify }: {
  domains: AdminDomain[];
  actions: Actions;
  isBusy: (id: string) => boolean;
  notify: Notify;
}) {
  const available = domains.filter((d) => d.status === "available").length;
  const tone = (s: AdminDomain["status"]): "ok" | "brand" | "muted" =>
    s === "available" ? "ok" : s === "registered" ? "brand" : "muted";

  return (
    <div className={card}>
      <SectionHead
        title="Registo de domínios"
        desc={available ? `${available} disponíveis de ${domains.length} consultas` : `${domains.length} consultas no registo`}
        right={
          <ActionBtn tone="ghost" busy={false} onClick={() => refreshAll()}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar tudo
          </ActionBtn>
        }
      />
      {domains.length === 0 ? (
        <Empty text="Ainda não há consultas de domínios." />
      ) : (
        <div className="divide-y divide-line">
          {domains.map((d, i) => (
            <motion.div
              key={d.id}
              className="flex flex-wrap items-center gap-3 py-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-paper">{d.full_domain}</p>
                <p className="text-xs text-muted">Verificado em {fmtDate(d.checked_at)}</p>
              </div>
              <span className="text-sm font-medium text-paper">{fmtMT(d.price)}</span>
              <Pill tone={tone(d.status)}>{d.status}</Pill>
              <div className="flex items-center gap-1.5">
                <ActionBtn busy={isBusy(d.id)} onClick={() => recheckOne(d)} title="Voltar a verificar disponibilidade pelo RDAP">
                  <RefreshCw className="h-3.5 w-3.5" /> Re-verificar
                </ActionBtn>
                <IconBtn
                  busy={isBusy(d.id)}
                  title="Remover do registo"
                  onClick={() => {
                    if (window.confirm(`Remover ${d.full_domain} do registo?`)) {
                      actions.deleteDomain(d.id).then((r) => notify(r.ok ? "ok" : "error", r.ok ? "Domínio removido do registo." : (r as { error: string }).error));
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  async function recheckOne(d: AdminDomain) {
    const r = await actions.recheckDomain(d.id);
    notify(r.ok ? "ok" : "error", r.ok ? `${d.full_domain} verificado.` : (r as { error: string }).error);
  }

  async function refreshAll() {
    for (const d of domains) {
      await actions.recheckDomain(d.id);
    }
    notify("ok", "Todos os domínios foram re-verificados.");
  }
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export function UsersView({ profiles, emailByUserId, adminUserId, actions, isBusy, notify }: {
  profiles: AdminProfile[];
  emailByUserId: Record<string, string>;
  adminUserId?: string;
  actions: Actions;
  isBusy: (id: string) => boolean;
  notify: Notify;
}) {
  const admins = profiles.filter((p) => p.role === "admin").length;

  return (
    <div className={card}>
      <SectionHead
        title="Utilizadores"
        desc={`${profiles.length} registados · ${admins} administradores`}
      />
      {profiles.length === 0 ? (
        <Empty text="Sem utilizadores registados." />
      ) : (
        <div className="divide-y divide-line">
          {profiles.map((p, i) => {
            const isSelf = p.id === adminUserId;
            return (
              <motion.div
                key={p.id}
                className="flex flex-wrap items-center gap-3 py-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-paper">
                    {p.full_name || "—"} {isSelf && <span className="text-xs font-normal text-muted">(tu)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{emailByUserId[p.id] || ""}{p.company ? ` · ${p.company}` : ""}</p>
                </div>
                <Pill tone={p.role === "admin" ? "brand" : "muted"}>{p.role}</Pill>
                <div className="flex items-center gap-1.5">
                  {p.role === "client" ? (
                    <ActionBtn tone="brand" busy={isBusy(p.id)} onClick={() => actions.setUserRole(p.id, "admin").then((r) => notify(r.ok ? "ok" : "error", r.ok ? `${p.full_name || "Utilizador"} passou a administrador.` : (r as { error: string }).error))}>
                      <ShieldPlus className="h-3.5 w-3.5" /> Tornar admin
                    </ActionBtn>
                  ) : (
                    <ActionBtn tone="danger" busy={isBusy(p.id)} disabled={isSelf} title={isSelf ? "Não podes remover o teu próprio acesso" : undefined} onClick={() => { if (window.confirm(`Remover o acesso de administrador de ${p.full_name || "este utilizador"}?`)) actions.setUserRole(p.id, "client").then((r) => notify(r.ok ? "ok" : "error", r.ok ? "Acesso de administrador removido." : (r as { error: string }).error)); }}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Remover admin
                    </ActionBtn>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function SettingsView({ adminEmail, isDark, setIsDark, notify }: {
  adminEmail?: string;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  notify: Notify;
}) {
  const router = useRouter();
  const [logouting, setLogouting] = useState(false);

  async function logout() {
    if (!window.confirm("Terminar a sessão do painel de administração?")) return;
    setLogouting(true);
    try {
      await supabaseBrowser.auth.signOut();
      router.replace("/login");
    } catch {
      setLogouting(false);
      notify("error", "Não foi possível terminar a sessão.");
    }
  }

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <div className={card}>
        <SectionHead title="Conta" desc="A sessão ativa no painel." />
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-content-center rounded-lg bg-brand/10 text-brand"><Users className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-medium text-paper">{adminEmail || "Administrador"}</p>
            <p className="text-xs text-muted">Acesso de administrador · gestão interna</p>
          </div>
        </div>
      </div>

      <div className={card}>
        <SectionHead title="Preferências" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-paper">Tema</p>
            <p className="text-xs text-muted">{isDark ? "Modo escuro ativo" : "Modo claro ativo"}</p>
          </div>
          <ActionBtn tone="ghost" onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {isDark ? "Modo claro" : "Modo escuro"}
          </ActionBtn>
        </div>
      </div>

      <div className={card}>
        <SectionHead title="Sessão" />
        <p className="mb-4 text-sm text-muted">Terminar a sessão devolve-te à página de entrada.</p>
        <ActionBtn tone="danger" busy={logouting} onClick={logout}>
          <LogOut className="h-3.5 w-3.5" /> Terminar sessão
        </ActionBtn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Help                                                                */
/* ------------------------------------------------------------------ */

export function HelpView() {
  const items = [
    { title: "Dashboard", desc: "Visão geral com estatísticas clicáveis para cada secção." },
    { title: "Mensagens", desc: "Trata contactos recebidos: marca como em progresso, conclui ou elimina." },
    { title: "Pedidos de domínio", desc: "Acompanha pedidos de registo: marca pagos, regista o domínio ou cancela." },
    { title: "Domínios", desc: "Volta a verificar a disponibilidade pelo RDAP e gere o registo local." },
    { title: "Utilizadores", desc: "Promove ou remove o acesso de administrador de utilizadores." },
    { title: "Definições", desc: "Conta, tema e fim de sessão." },
  ];
  return (
    <div className={card}>
      <SectionHead title="Ajuda" desc="O que podes fazer em cada secção do painel." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.06, ease: "easeOut" }}
            className="rounded-lg border border-line bg-ink p-4"
          >
            <p className="text-sm font-medium text-paper">{it.title}</p>
            <p className="mt-1 text-xs text-muted">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* Re-exported for convenience */

export type { Notice };