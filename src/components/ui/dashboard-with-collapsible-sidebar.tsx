"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Monitor,
  ShoppingCart,
  Users,
  ChevronDown,
  Bell,
  Settings,
  HelpCircle,
  MessageSquare,
  Globe,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import type { AdminMessage, AdminOrder, AdminDomain, AdminProfile, Notice } from "./admin/types";
import { useAdminData } from "./admin/use-admin-data";
import {
  OverviewView,
  MessagesView,
  OrdersView,
  DomainsView,
  UsersView,
  SettingsView,
  HelpView,
} from "./admin/views";

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
};

type ViewId = "Dashboard" | "Mensagens" | "Pedidos" | "Domínios" | "Utilizadores" | "Definições" | "Ajuda";

const fmtMT = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-PT")} MT`);

const TITLES: Record<ViewId, { title: string; sub: string }> = {
  Dashboard: { title: "Painel de administração", sub: "Visão geral da atividade do site." },
  Mensagens: { title: "Mensagens de contacto", sub: "Trata os contactos recebidos." },
  Pedidos: { title: "Pedidos de domínio", sub: "Acompanha os pedidos de registo." },
  Domínios: { title: "Registo de domínios", sub: "Disponibilidade e consultas RDAP." },
  Utilizadores: { title: "Utilizadores", sub: "Contas e acessos de administração." },
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
}: DashboardProps) {
  const { data, refresh, refreshing, isBusy, actions } = useAdminData({ messages, orders, domains, profiles, emailByUserId });
  const [active, setActive] = useState<ViewId>("Dashboard");
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

  async function onRefresh() {
    const r = await refresh();
    notify(r.ok ? "ok" : "error", r.ok ? "Dados atualizados." : (r as { error: string }).error);
  }

  const nav: NavItem[] = [
    { id: "Dashboard", label: "Dashboard", Icon: Home },
    { id: "Mensagens", label: "Mensagens", Icon: MessageSquare, notifs: newMsgs },
    { id: "Pedidos", label: "Pedidos de domínio", Icon: ShoppingCart, notifs: pendingOrders },
    { id: "Domínios", label: "Domínios", Icon: Globe, notifs: availableDomains },
    { id: "Utilizadores", label: "Utilizadores", Icon: Users },
    { id: "__site", label: "Ver site", Icon: Monitor, href: "/" },
  ];

  const activeMeta = TITLES[active];

  return (
    <div className={`flex min-h-screen w-full font-display-2 ${isDark ? "dark" : ""}`}>
      <div className="flex w-full bg-ink text-paper">
        <Sidebar nav={nav} active={active} onSelect={setActive} />

        <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden bg-ink">
          <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-ink px-6 py-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <h1 className="text-[14.4px] font-bold text-paper">{activeMeta.title}</h1>
                <p className="mt-0.5 text-sm text-muted">{activeMeta.sub}</p>
              </motion.div>
            </AnimatePresence>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActive("Mensagens")}
                className="relative rounded-lg border border-line bg-surface p-2 text-muted transition-colors hover:text-paper"
                title="Mensagens por tratar"
              >
                <Bell className="h-4 w-4" />
                {newMsgs > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium text-white">{newMsgs}</span>}
              </button>
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

          <main className="flex-1 p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {active === "Dashboard" && <OverviewView data={data} go={(v) => setActive(v as ViewId)} />}
                {active === "Mensagens" && <MessagesView messages={data.messages} actions={actions} isBusy={isBusy} notify={notify} />}
                {active === "Pedidos" && <OrdersView orders={data.orders} actions={actions} isBusy={isBusy} notify={notify} />}
                {active === "Domínios" && <DomainsView domains={data.domains} actions={actions} isBusy={isBusy} notify={notify} />}
                {active === "Utilizadores" && (
                  <UsersView profiles={data.profiles} emailByUserId={data.emailByUserId} adminUserId={adminUserId} actions={actions} isBusy={isBusy} notify={notify} />
                )}
                {active === "Definições" && <SettingsView adminEmail={adminEmail} isDark={isDark} setIsDark={setIsDark} notify={notify} />}
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
                className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
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

  return (
    <motion.nav
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 256 : 64 }}
      transition={{ type: "tween", duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
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