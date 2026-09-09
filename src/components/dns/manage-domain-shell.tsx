"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, Gauge, ListTree, Server, ShieldCheck } from "lucide-react";

import { ToastProvider } from "@/components/ui/core";

const TABS = [
  { id: "overview", label: "Overview", icon: Gauge, href: "" },
  { id: "dns", label: "DNS Management", icon: ListTree, href: "/dns" },
  { id: "nameservers", label: "Nameservers", icon: Server, href: "/nameservers" },
  { id: "security", label: "Security", icon: ShieldCheck, href: "/security" },
  { id: "activity", label: "Activity", icon: Activity, href: "/activity" },
];

export default function ManageDomainShell({
  fullDomain,
  children,
}: {
  fullDomain: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/dashboard/domains/${encodeURIComponent(fullDomain)}`;

  const isActive = (href: string) => {
    if (!href) return pathname === base;
    return pathname.startsWith(`${base}${href}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-muted">
            <Link className="hover:text-paper" href="/dashboard/domains">
              Domínios
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-paper">{fullDomain}</span>
          </nav>
          <h1 className="font-display-2 text-2xl font-semibold tracking-tight">{fullDomain}</h1>
          <p className="text-muted">Gestão completa de DNS — registos, nameservers, segurança e atividade.</p>
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

      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}