"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Home,
  DollarSign,
  Monitor,
  ShoppingCart,
  Users,
  ChevronDown,
  ChevronsRight,
  Bell,
  Settings,
  HelpCircle,
  MessageSquare,
  Globe,
  TrendingUp,
  Sun,
  Moon,
} from "lucide-react";

export type AdminMessage = { name: string; email: string; service: string; message?: string; status: string; created_at: string };
export type AdminOrder = { full_domain: string; name: string; email: string; price: number | null; status: string; created_at: string };
export type AdminDomain = { full_domain: string; status: string; price: number | null; checked_at: string };
export type AdminProfile = { full_name?: string | null; company?: string | null; role: string; id: string };

type ExampleProps = {
  adminEmail?: string;
  messages?: AdminMessage[];
  orders?: AdminOrder[];
  domains?: AdminDomain[];
  profiles?: AdminProfile[];
  emailByUserId?: Record<string, string>;
};

const fmtMT = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-PT")} MT`);

export default function DashboardWithCollapsibleSidebar({
  adminEmail,
  messages = [],
  orders = [],
  domains = [],
  profiles = [],
}: ExampleProps) {
  // O site é dark por base — iniciamos em modo escuro.
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const newMsgs = messages.filter((m) => m.status === "new").length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const availableDomains = domains.filter((d) => d.status === "available").length;

  return (
    <div className={`flex min-h-screen w-full font-display-2 ${isDark ? "dark" : ""}`}>
      <div className="flex w-full bg-ink text-paper">
        <Sidebar
          newMsgs={newMsgs}
          pendingOrders={pendingOrders}
          availableDomains={availableDomains}
        />
        <Content
          isDark={isDark}
          setIsDark={setIsDark}
          adminEmail={adminEmail}
          messages={messages}
          orders={orders}
          domains={domains}
          profiles={profiles}
        />
      </div>
    </div>
  );
}

type SidebarProps = {
  newMsgs: number;
  pendingOrders: number;
  availableDomains: number;
};

const Sidebar = ({ newMsgs, pendingOrders, availableDomains }: SidebarProps) => {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("Dashboard");

  const nav = [
    { Icon: Home, title: "Dashboard" },
    { Icon: DollarSign, title: "Mensagens", notifs: newMsgs },
    { Icon: ShoppingCart, title: "Pedidos de domínio", notifs: pendingOrders },
    { Icon: Globe, title: "Domínios", notifs: availableDomains },
    { Icon: Users, title: "Utilizadores" },
    { Icon: Monitor, title: "Ver site", href: "/" },
  ];

  return (
    <nav
      className={`sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out ${
        open ? "w-64" : "w-16"
      } border-line bg-surface p-2 shadow-sm`}
    >
      <TitleSection open={open} />

      <div className="mb-8 space-y-1">
        {nav.map((item) => (
          <Option
            key={item.title}
            Icon={item.Icon}
            title={item.title}
            selected={selected}
            setSelected={setSelected}
            open={open}
            notifs={item.notifs}
            href={item.href}
          />
        ))}
      </div>

      {open && (
        <div className="space-y-1 border-t border-line pt-4">
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            Conta
          </div>
          <Option Icon={Settings} title="Definições" selected={selected} setSelected={setSelected} open={open} />
          <Option Icon={HelpCircle} title="Ajuda" selected={selected} setSelected={setSelected} open={open} />
        </div>
      )}

      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
};

const Option = ({ Icon, title, selected, setSelected, open, notifs, href }: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  selected: string;
  setSelected: (t: string) => void;
  open: boolean;
  notifs?: number;
  href?: string;
}) => {
  const isSelected = selected === title;

  const base = (
    <button
      onClick={() => setSelected(title)}
      className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${
        isSelected
          ? "border-l-2 border-brand bg-brand/10 text-paper shadow-sm"
          : "text-muted hover:bg-surface-2 hover:text-paper"
      }`}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-4 w-4" />
      </div>

      {open && (
        <span className={`text-sm font-medium transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
          {title}
        </span>
      )}

      {notifs != null && notifs > 0 && open && (
        <span className="absolute right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium text-white">
          {notifs}
        </span>
      )}
    </button>
  );

  if (href) {
    return <Link href={href} className="block w-full">{base}</Link>;
  }
  return base;
};

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className="mb-6 border-b border-line pb-4">
      <div className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-surface-2">
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div className={`transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
              <span className="block text-sm font-semibold text-paper">IDesign <b className="text-brand">Admin</b></span>
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
    <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-brand to-brand-hover shadow-sm">
      <svg width="20" height="auto" viewBox="0 0 50 39" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-white">
        <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
        <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z" />
      </svg>
    </div>
  );
};

const ToggleClose = ({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) => {
  return (
    <button
      onClick={() => setOpen(!open)}
      className="absolute bottom-0 left-0 right-0 border-t border-line transition-colors hover:bg-surface-2"
    >
      <div className="flex items-center p-3">
        <div className="grid size-10 place-content-center">
          <ChevronsRight
            className={`h-4 w-4 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </div>
        {open && (
          <span className={`text-sm font-medium text-muted transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
            Recolher
          </span>
        )}
      </div>
    </button>
  );
};

type ContentProps = {
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  adminEmail?: string;
  messages: AdminMessage[];
  orders: AdminOrder[];
  domains: AdminDomain[];
  profiles: AdminProfile[];
};

const Content = ({ isDark, setIsDark, adminEmail, messages, orders, domains, profiles }: ContentProps) => {
  const newMsgs = messages.filter((m) => m.status === "new").length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const availableDomains = domains.filter((d) => d.status === "available").length;
  const card = "rounded-xl border border-line bg-surface p-6 shadow-sm";
  const label = "text-sm font-medium text-muted mb-1";
  const num = "text-2xl font-bold text-paper";

  const activities = messages.slice(0, 6).map((m) => ({
    icon: MessageSquare,
    title: m.name || "Mensagem",
    desc: m.message ?? m.email,
    time: new Date(m.created_at).toLocaleDateString("pt-PT"),
    color: m.status === "new" ? "red" : "blue",
  }));

  return (
    <div className="flex-1 overflow-auto bg-ink p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-paper">Painel de administração</h1>
          <p className="mt-1 text-muted">Bem-vindo de volta ao seu dashboard{adminEmail ? `, ${adminEmail}` : ""}</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative rounded-lg border border-line bg-surface p-2 text-muted transition-colors hover:text-paper">
            <Bell className="h-5 w-5" />
            {(newMsgs + pendingOrders) > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand" />}
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-paper"
            aria-label="Alternar tema"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-paper">
            Ver site ↗
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-brand/10 p-2"><MessageSquare className="h-5 w-5 text-brand" /></div>
            <TrendingUp className="h-4 w-4 text-ok" />
          </div>
          <h3 className={label}>Mensagens</h3>
          <p className={num}>{messages.length}</p>
          <p className="mt-1 text-sm text-ok">{newMsgs} novas</p>
        </div>

        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-brand/10 p-2"><ShoppingCart className="h-5 w-5 text-brand" /></div>
            <TrendingUp className="h-4 w-4 text-ok" />
          </div>
          <h3 className={label}>Pedidos de domínio</h3>
          <p className={num}>{orders.length}</p>
          <p className="mt-1 text-sm text-ok">{pendingOrders} pendentes</p>
        </div>

        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-brand/10 p-2"><Globe className="h-5 w-5 text-brand" /></div>
            <TrendingUp className="h-4 w-4 text-ok" />
          </div>
          <h3 className={label}>Domínios disponíveis</h3>
          <p className={num}>{availableDomains}<span className="text-sm text-muted"> / {domains.length}</span></p>
          <p className="mt-1 text-sm text-muted">no registo</p>
        </div>

        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-brand/10 p-2"><Users className="h-5 w-5 text-brand" /></div>
            <TrendingUp className="h-4 w-4 text-ok" />
          </div>
          <h3 className={label}>Utilizadores</h3>
          <p className={num}>{profiles.length}</p>
          <p className="mt-1 text-sm text-muted">registados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={card}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-paper">Mensagens de contacto</h3>
            </div>
            <div className="space-y-4">
              {activities.length ? activities.map((activity, i) => (
                <div key={i} className="flex cursor-pointer items-center space-x-4 rounded-lg p-3 transition-colors hover:bg-surface-2">
                  <div className={`rounded-lg p-2 ${activity.color === "red" ? "bg-brand/10" : "bg-surface-2"}`}>
                    <activity.icon className={`h-4 w-4 ${activity.color === "red" ? "text-brand" : "text-muted"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-paper">{activity.title}</p>
                    <p className="truncate text-xs text-muted">{activity.desc} · {activity.time}</p>
                  </div>
                </div>
              )) : <p className="text-sm text-muted">Sem mensagens.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={card}>
            <h3 className="mb-4 text-lg font-semibold text-paper">Pedidos de domínio</h3>
            <div className="space-y-3">
              {orders.slice(0, 5).map((o, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="truncate text-sm text-muted">{o.full_domain}</span>
                  <span className="text-sm font-medium text-paper">{fmtMT(o.price)}</span>
                </div>
              ))}
              {!orders.length && <p className="text-sm text-muted">Sem pedidos.</p>}
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-4 text-lg font-semibold text-paper">Utilizadores</h3>
            <div className="space-y-3">
              {profiles.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <span className="truncate text-sm text-muted">{p.full_name || "—"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.role === "admin" ? "bg-brand text-white" : "bg-surface-2 text-muted"}`}>
                    {p.role}
                  </span>
                </div>
              ))}
              {!profiles.length && <p className="text-sm text-muted">Sem utilizadores.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
