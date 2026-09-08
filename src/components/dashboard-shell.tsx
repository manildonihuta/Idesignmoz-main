"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Visão geral", icon: "□" },
  { href: "/dashboard/websites", label: "Websites", icon: "◻" },
  { href: "/dashboard/ai-builder", label: "Criar com IA", icon: "◇" },
  { href: "/dashboard/domains", label: "Domínios", icon: "◎" },
  { href: "/dashboard/hosting", label: "Alojamento", icon: "▣" },
  { href: "/dashboard/subscriptions", label: "Subscrições", icon: "↻" },
  { href: "/dashboard/projects", label: "Projectos", icon: "◫" },
  { href: "/dashboard/orders", label: "Encomendas", icon: "▤" },
  { href: "/dashboard/invoices", label: "Facturas", icon: "▥" },
  { href: "/dashboard/payments", label: "Pagamentos", icon: "⬡" },
  { href: "/dashboard/email", label: "Email", icon: "✉" },
  { href: "/dashboard/tickets", label: "Tickets", icon: "◈" },
  { href: "/dashboard/profile", label: "Perfil", icon: "◉" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <Link href="/">IDesign Moz</Link>
        </div>
        <nav className="dash-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              className={`dash-link ${isActive(item.href) ? "active" : ""}`}
              href={item.href}
            >
              <span className="dash-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="dash-footer">
          <Link className="dash-link" href="/">
            <span className="dash-icon">←</span>
            Voltar ao site
          </Link>
        </div>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <Link className="dash-brand-mobile" href="/">
            IDesign Moz
          </Link>
          <div className="dash-user">
            <span className="dash-avatar">M</span>
            <span className="dash-name">Conta</span>
          </div>
        </header>
        <main id="main" className="dash-content">{children}</main>
      </div>
    </div>
  );
}