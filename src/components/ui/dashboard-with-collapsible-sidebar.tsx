"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Home,
  Monitor,
  ShoppingCart,
  ChevronDown,
  Bell,
  Settings,
  HelpCircle,
  MessageSquare,
  Globe,
  RefreshCw,
  Sun,
  Moon,
  Users2,
  Boxes,
  Network,
  ServerCog,
  Rocket,
  FileKey2,
  HeartHandshake,
  FileSignature,
  ListTree,
  ChartColumn,
  UserRound,
  Repeat,
} from "lucide-react";
import type { AdminMessage, AdminOrder, AdminDomain, AdminProfile, AdminSubscription, Notice } from "./admin/types";
import { useAdminData } from "./admin/use-admin-data";
import { ActivityDropdown, type ActivityItem } from "./core/activity-dropdown";
import {
  OverviewView,
  MessagesView,
  OrdersView,
  DomainsView,
  UsersView,
  SettingsView,
  HelpView,
} from "./admin/views";
import {
  CustomersView,
  ProductsView,
  DomainsAdminView,
  HostingAdminView,
  ProvisioningView,
} from "./admin/manage-views";
import { CrmView } from "./admin/crm-views";
import { ProposalsSystemView } from "./admin/proposals-system-view";
import { AnalyticsView } from "./admin/analytics-view";
import { SiteSettingsView } from "./admin/settings-views";
import { SubscriptionsAdminView } from "./admin/subscriptions-admin-view";
import { DnsZonesView } from "./admin/dns-admin-views";
import { AdminHostingAccountsView } from "./admin/hosting-admin-views";
import type { CompanyInfo } from "@/lib/site-settings";
import type { ProposalServiceItem } from "@/lib/proposals";

/* ----------------------------- Types ------------------------------ */

export type AdminMessageRow = AdminMessage;
export type AdminOrderRow = AdminOrder;
export type AdminDomainRow = AdminDomain;
export type AdminProfileRow = AdminProfile;

type DashboardProps = {
  adminEmail?: string;
  adminUserId?: string;
  messages?: AdminMessage[];
  orders?: AdminOrder[];
  domains?: AdminDomain[];
  profiles?: AdminProfile[];
  emailByUserId?: Record<string, string>;
  subscriptions?: AdminSubscription[];
  company: CompanyInfo;
  proposalCatalog?: ProposalServiceItem[];
};

type ViewId = "Dashboard" | "Analytics" | "Mensagens" | "Pedidos" | "Domínios" | "DNS" | "Domínio Admin" | "CRM" | "Propostas" | "Utilizadores" | "Clientes" | "Produtos" | "Alojamento" | "Contas de alojamento" | "Subscrições" | "Provisioning" | "Definições" | "Ajuda";

const fmtMT = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-PT")} MT`);

const TITLES: Record<ViewId, { title: string; sub: string }> = {
  Dashboard: { title: "Painel de administração", sub: "Visão geral da atividade do site." },
  Analytics: { title: "Analytics", sub: "Tráfego, receita e funil de conversão." },
  Mensagens: { title: "Mensagens de contacto", sub: "Trata os contactos recebidos." },
  Pedidos: { title: "Pedidos de domínio", sub: "Acompanha os pedidos de registo." },
  Domínios: { title: "Registo de domínios", sub: "Disponibilidade e consultas RDAP." },
  DNS: { title: "DNS Management", sub: "Zonas, registos, nameservers e DNSSEC dos domínios." },
  "Domínio Admin": { title: "Domínio Admin", sub: "Preços, registo, suspensão e renovação." },
  CRM: { title: "CRM interno", sub: "Leads, oportunidades, propostas, projetos e relação com clientes." },
  Propostas: { title: "Propostas", sub: "Cria, envia e acompanha propostas comerciais." },
  Utilizadores: { title: "Utilizadores", sub: "Contas e acessos de administração." },
  Clientes: { title: "Gestão de clientes", sub: "Cria, edita, suspende e consulta clientes." },
  Produtos: { title: "Produtos e preços", sub: "Catálogo, planos, categorias e cupões." },
  Alojamento: { title: "Planos de alojamento", sub: "Recursos, preços, ciclo, servidor e estado." },
  "Contas de alojamento": { title: "Contas de alojamento", sub: "Contas ativas, uso real, planos, estado e aprovisionamento." },
  Subscrições: { title: "Subscrições", sub: "Estado, ciclo de faturação e vida útil das subscrições." },
  Provisioning: { title: "Provisioning", sub: "Ativação de alojamento e de domínios (WHM/cPanel, Plesk, VPS, registradores)." },
  Definições: { title: "Definições", sub: "Conta, tema e sessão." },
  Ajuda: { title: "Ajuda", sub: "Como utilizar o painel." },
};

export default function DashboardWithCollapsibleSidebar({
  adminEmail,
  adminUserId,
  messages = [],
  orders = [],
  domains = [],
  profiles = [],
  emailByUserId = {},
  subscriptions = [],
  company,
  proposalCatalog = [],
}: DashboardProps) {
  const { data, refresh, refreshing, isBusy, actions } = useAdminData({ messages, orders, domains, profiles, emailByUserId, subscriptions });
  const [active, setActive] = useState<ViewId>("Dashboard");
  const reduced = useReducedMotion();
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = window.localStorage.getItem("admin-theme");
      return saved ? saved === "dark" : true;
    } catch {
      return true;
    }
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Theme */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      window.localStorage.setItem("admin-theme", isDark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [isDark]);

  /* Toasts */
  const notify = useCallback((type: "ok" | "error", text: string) => {
    setNotice({ type, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  const newMsgs = data.messages.filter((m) => m.status === "new").length;
  const pendingOrders = data.orders.filter((o) => o.status === "pending").length;
  const availableDomains = data.domains.filter((d) => d.status === "available").length;
  const nonActiveSubs = data.subscriptions.filter((s) => s.status === "past_due" || s.status === "suspended").length;

  async function onRefresh() {
    const r = await refresh();
    notify(r.ok ? "ok" : "error", r.ok ? "Dados atualizados." : (r as { error: string }).error);
  }

  const nav: NavItem[] = [
    { id: "Dashboard", label: "Dashboard", Icon: Home },
    { id: "Analytics", label: "Analytics", Icon: ChartColumn },
    { id: "Clientes", label: "Clientes", Icon: Users2 },
    { id: "Produtos", label: "Produtos", Icon: Boxes },
    { id: "CRM", label: "CRM", Icon: HeartHandshake },
    { id: "Propostas", label: "Propostas", Icon: FileSignature },
    { id: "Domínio Admin", label: "Domínio Admin", Icon: FileKey2 },
    { id: "Domínios", label: "Domínios", Icon: Globe, notifs: availableDomains },
    { id: "DNS", label: "DNS", Icon: ListTree, notifs: 0 },
    { id: "Alojamento", label: "Alojamento", Icon: ServerCog },
    { id: "Contas de alojamento", label: "Contas de alojamento", Icon: UserRound },
    { id: "Subscrições", label: "Subscrições", Icon: Repeat, notifs: nonActiveSubs },
    { id: "Provisioning", label: "Provisioning", Icon: Rocket },
    { id: "Mensagens", label: "Mensagens", Icon: MessageSquare, notifs: newMsgs },
    { id: "Pedidos", label: "Pedidos de domínio", Icon: ShoppingCart, notifs: pendingOrders },
    { id: "Utilizadores", label: "Utilizadores", Icon: Network },
    { id: "__site", label: "Ver site", Icon: Monitor, href: "/" },
  ];

  const activeMeta = TITLES[active];

  return (
    <div className={`flex min-h-screen w-full font-display-2 ${isDark ? "dark" : ""}`}>
      <div className="flex w-full bg-ink text-paper">
        <Sidebar nav={nav} active={active} onSelect={setActive} />

        <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden bg-ink pb-20 md:pb-0">
          <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-ink px-6 py-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
              >
                <h1 className="text-[14.4px] font-bold text-paper">{activeMeta.title}</h1>
                <p className="mt-0.5 text-sm text-muted">{activeMeta.sub}</p>
              </motion.div>
            </AnimatePresence>
            <div className="flex items-center gap-2">
              <NotificationsBell />
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="rounded-lg border border-line bg-surface p-2 text-muted transition-colors hover:text-paper disabled:opacity-50"
                title="Atualizar dados"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsDark(!isDark)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-paper"
                title="Alternar tema"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link href="/" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-paper">
                Ver site ↗
              </Link>
            </div>
          </header>

          <main id="main" className="flex-1 p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {active === "Dashboard" && <OverviewView data={data} go={(v) => setActive(v as ViewId)} />}
                {active === "Analytics" && <AnalyticsView />}
                {active === "Mensagens" && <MessagesView messages={data.messages} actions={actions} isBusy={isBusy} notify={notify} />}
                {active === "Pedidos" && <OrdersView orders={data.orders} actions={actions} isBusy={isBusy} notify={notify} />}
                {active === "Domínios" && <DomainsView domains={data.domains} actions={actions} isBusy={isBusy} notify={notify} />}
                {active === "DNS" && <DnsZonesView notify={notify} />}
                {active === "Utilizadores" && (
                  <UsersView profiles={data.profiles} emailByUserId={data.emailByUserId} adminUserId={adminUserId} actions={actions} isBusy={isBusy} notify={notify} />
                )}
                {active === "Clientes" && <CustomersView notify={notify} />}
                {active === "Produtos" && <ProductsView notify={notify} />}
                {active === "CRM" && <CrmView notify={notify} />}
                {active === "Propostas" && <ProposalsSystemView notify={notify} company={company} catalog={proposalCatalog} />}
                {active === "Domínio Admin" && <DomainsAdminView notify={notify} />}
                {active === "Alojamento" && <HostingAdminView notify={notify} />}
                {active === "Contas de alojamento" && <AdminHostingAccountsView notify={notify} />}
                {active === "Subscrições" && (
                  <SubscriptionsAdminView subscriptions={data.subscriptions} actions={actions} isBusy={isBusy} notify={notify} />
                )}
                {active === "Provisioning" && <ProvisioningView notify={notify} />}
                {active === "Definições" && (
                  <div className="flex flex-col gap-8">
                    <SettingsView adminEmail={adminEmail} isDark={isDark} setIsDark={setIsDark} notify={notify} />
                    <div className="mb-1 border-t border-line pt-6">
                      <h3 className="mb-1 text-sm font-semibold text-brand">Definições do site</h3>
                      <p className="mb-4 text-xs text-muted">Marca, impostos, pagamentos, e-mail, domínios e integrações da plataforma.</p>
                      <SiteSettingsView notify={notify} />
                    </div>
                  </div>
                )}
                {active === "Ajuda" && <HelpView />}
              </motion.div>
            </AnimatePresence>
          </main>

          <AnimatePresence>
            {notice && (
              <motion.div
                key="toast"
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`fixed bottom-20 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg md:bottom-4 ${
                  notice.type === "ok" ? "border-ok bg-surface text-ok" : "border-brand bg-surface text-brand"
                }`}
                role="status"
              >
                {notice.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <BottomNav active={active} onSelect={setActive} />
    </div>
  );
}

/* ----------------------------- Bottom navigation (mobile) ----------------------------- */

const BOTTOM_NAV: Array<{ id: ViewId; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: "Dashboard", label: "Home", Icon: Home },
  { id: "Produtos", label: "Products", Icon: Boxes },
  { id: "Pedidos", label: "Orders", Icon: ShoppingCart },
  { id: "Ajuda", label: "Support", Icon: HelpCircle },
  { id: "Definições", label: "Profile", Icon: UserRound },
];

const BottomNav = ({ active, onSelect }: { active: ViewId; onSelect: (v: ViewId) => void }) => (
  <nav
    className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    aria-label="Navegação rápida"
  >
    {BOTTOM_NAV.map((item) => {
      const isActive = active === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          aria-current={isActive ? "page" : undefined}
          className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
            isActive ? "text-brand" : "text-muted hover:text-paper"
          }`}
        >
          <item.Icon className="h-5 w-5" />
          {item.label}
        </button>
      );
    })}
  </nav>
);

/* ----------------------------- Notifications bell ----------------------------- */

type NotifItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const fmtWhen = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
};

async function fetchNotifItems(): Promise<NotifItem[] | null> {
  try {
    const res = await fetch("/api/notifications", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; items?: NotifItem[] };
    return data.ok ? (data.items ?? []) : null;
  } catch {
    return null;
  }
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      const loaded = await fetchNotifItems();
      if (!active) return;
      setItems(loaded ?? []);
      setLoading(false);
    }

    loadInitial();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    async function poll() {
      const loaded = await fetchNotifItems();
      if (loaded) setItems(loaded);
    }
    const timer = setInterval(() => void poll(), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const unread = items.filter((i) => !i.readAt).length;

  async function markRead(id?: string) {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: id ? JSON.stringify({ id }) : "{}",
      });
    } catch {
      /* ignore */
    } finally {
      const loaded = await fetchNotifItems();
      if (loaded) setItems(loaded);
    }
  }

  const notifIcon = (kind: string) => {
    if (kind.includes("subscription")) return RefreshCw;
    if (kind.includes("hosting")) return ServerCog;
    if (kind.includes("domain")) return Globe;
    if (kind.includes("ai_site")) return Rocket;
    if (kind.includes("project")) return FileSignature;
    return Bell;
  };

  const activityItems: ActivityItem[] = items.map((item) => ({
    id: item.id,
    icon: notifIcon(item.kind),
    title: item.title,
    description: item.body ?? undefined,
    time: fmtWhen(item.createdAt),
  }));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg border border-line bg-surface p-2 text-muted transition-colors hover:text-paper"
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium text-white">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-80"
          >
            <ActivityDropdown
              open
              onToggle={() => setOpen((v) => !v)}
              title={
                items.length === 0
                  ? "Notificações"
                  : unread > 0
                    ? `${unread} por ler`
                    : "Tudo lido"
              }
              subtitle="Tem novidades no painel"
              items={activityItems}
              icon={Bell}
              emptyText={loading ? "A carregar…" : "Sem notificações."}
              renderItemExtra={(item) => {
                const notif = items.find((n) => n.id === item.id);
                if (!notif || notif.readAt) return null;
                return (
                  <button
                    type="button"
                    onClick={() => void markRead(item.id)}
                    className="mt-1 block text-xs text-brand hover:underline"
                  >
                    Marcar como lida
                  </button>
                );
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------- Sidebar ----------------------------- */

type NavItem = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  href?: string;
  notifs?: number;
};

type SidebarProps = {
  nav: NavItem[];
  active: string;
  onSelect: (v: ViewId) => void;
};

const Sidebar = ({ nav, active, onSelect }: SidebarProps) => {
  const [open, setOpen] = useState(true);
  const reduced = useReducedMotion();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setOpen(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <motion.nav
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 256 : 64 }}
      transition={{ type: "tween", duration: reduced ? 0 : 0.32, ease: [0.25, 1, 0.5, 1] }}
      className="sticky top-0 h-screen shrink-0 overflow-hidden border-r border-line bg-surface p-2 shadow-sm"
    >
      <TitleSection open={open} />

      <div className="mb-8 space-y-1">
        {nav.map((item) => (
          <Option key={item.id} item={item} active={active} onSelect={onSelect} open={open} />
        ))}
      </div>

      {open && (
        <div className="space-y-1 border-t border-line pt-4">
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">Conta</div>
          <Option item={{ id: "Definições", label: "Definições", Icon: Settings }} active={active} onSelect={onSelect} open={open} />
          <Option item={{ id: "Ajuda", label: "Ajuda", Icon: HelpCircle }} active={active} onSelect={onSelect} open={open} />
        </div>
      )}
    </motion.nav>
  );
};

const Option = ({ item, active, onSelect, open }: {
  item: NavItem;
  active: string;
  onSelect: (v: ViewId) => void;
  open: boolean;
}) => {
  const isSelected = active === item.id;
  const inner = (
    <>
      <div className="grid h-full w-12 place-content-center">
        <item.Icon className="h-4 w-4" />
      </div>
      <span className={`text-sm font-medium transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}>
        {item.label}
      </span>
      {item.notifs != null && item.notifs > 0 && open && (
        <span className="absolute right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium text-white">
          {item.notifs}
        </span>
      )}
    </>
  );
  const cls = `relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${
    isSelected
      ? "border-l-2 border-brand bg-brand/10 text-paper shadow-sm"
      : "text-muted hover:bg-surface-2 hover:text-paper"
  }`;
  const motionProps = {
    whileHover: { scale: isSelected ? 1 : 1.02 },
    whileTap: { scale: 0.96 },
    transition: { type: "spring" as const, stiffness: 500, damping: 30 },
  };

  if (item.href) {
    return (
      <MotionLink href={item.href} className={`${cls} block`} {...motionProps}>
        {inner}
      </MotionLink>
    );
  }
  return (
    <motion.button type="button" onClick={() => onSelect(item.id as ViewId)} className={cls} {...motionProps}>
      {inner}
    </motion.button>
  );
};

const MotionLink = motion(Link);

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className="mb-6 border-b border-line pb-4">
      <div className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-surface-2">
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div className={`transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}>
              <span className="block text-[8.4px] font-semibold text-paper">IDesign <b className="text-brand">Admin</b></span>
              <span className="block text-xs text-muted">Gestão interna</span>
            </div>
          )}
        </div>
        {open && <ChevronDown className="h-4 w-4 text-muted" />}
      </div>
    </div>
  );
};

const Logo = () => {
  return (
    <div className="grid size-10 shrink-0 place-content-center overflow-hidden rounded-lg bg-surface-2 shadow-sm">
      <Image src="/icon.png" alt="IDesign Moz" width={1224} height={1285} />
    </div>
  );
};

export { fmtMT };