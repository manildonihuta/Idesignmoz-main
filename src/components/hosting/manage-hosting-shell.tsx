"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, Archive, Bell, Database, Gauge, Globe, History, Lock, ShieldCheck, Terminal } from "lucide-react";

import { ToastProvider, SkeletonText, StatusBadge } from "@/components/ui/core";
import { HostingPanelContext, useHostingBundle } from "@/components/hosting/hosting-shared";

const TABS = [
  { id: "overview", label: "Overview", icon: Gauge, href: "" },
  { id: "websites", label: "Sites", icon: Globe, href: "/websites" },
  { id: "databases", label: "Bases de dados", icon: Database, href: "/databases" },
  { id: "backups", label: "Backups", icon: Archive, href: "/backups" },
  { id: "ssl", label: "SSL", icon: Lock, href: "/ssl" },
  { id: "security", label: "Segurança", icon: ShieldCheck, href: "/security" },
  { id: "performance", label: "Desempenho", icon: Activity, href: "/performance" },
  { id: "advanced", label: "Avançado", icon: Terminal, href: "/advanced" },
  { id: "alerts", label: "Alertas", icon: Bell, href: "/alerts" },
  { id: "activity", label: "Atividade", icon: History, href: "/activity" },
];

export default function ManageHostingShell({ hostingId, children }: { hostingId: string; children: ReactNode }) {
  const pathname = usePathname();
  const base = `/dashboard/hosting/${hostingId}`;
  const { bundle } = useHostingBundle(hostingId);

  const isActive = (href: string) => {
    if (!href) return pathname === base;
    return pathname.startsWith(`${base}${href}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <nav className="mb-1 text-xs text-muted">
            <Link className="hover:text-paper" href="/dashboard/hosting">
              Alojamento
            </Link>
            <span className="mx-2 opacity-50">/</span>
            {bundle ? (
              <span className="text-paper">{bundle.account.domain ?? "Conta"}</span>
            ) : (
              <span className="text-muted">…</span>
            )}
          </nav>
          <h1 className="truncate font-display-2 text-2xl font-semibold tracking-tight">
            {bundle ? (bundle.account.domain ?? "Conta de alojamento") : "Conta de alojamento"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {bundle ? (
              <>
                <span className="truncate">{bundle.account.username ?? bundle.account.domain ?? "—"}</span>
                <span className="opacity-50">·</span>
                <StatusBadge tone="brand">{bundle.provider.label}</StatusBadge>
                {bundle.plan ? <span>· Plano {bundle.plan.name}</span> : null}
              </>
            ) : (
              <SkeletonText lines={1} className="max-w-xs" />
            )}
          </div>
          <p className="mt-1 text-muted">Painel de gestão completo do teu alojamento.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1 border-b border-line pt-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.id}
                href={tab.href ? `${base}${tab.href}` : base}
                className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm ${
                  active ? "border border-b-0 border-line bg-ink text-paper" : "text-muted hover:text-paper"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="size-4" />
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <ToastProvider>
        <HostingPanelContext.Provider value={{ bundle }}>{children}</HostingPanelContext.Provider>
      </ToastProvider>
    </div>
  );
}