"use client";

import Link from "next/link";

import type { CrossSellOffer } from "@/lib/catalog-types";
import { CrossSellRecommendations } from "@/components/cross-sell-recommendations";

type Counts = {
  domains: number;
  tickets: number;
  invoices: number;
  projects: number;
  orders: number;
  hosting: number;
};

type Stat = { label: string; value: string | number; icon: string; href: string };
type Card = { label: string; count: number; icon: string; href: string };

export function DashboardOverview({
  counts,
  offers = [],
}: {
  counts: Counts;
  offers?: CrossSellOffer[];
}) {
  const stats: Stat[] = [
    { label: "Encomendas", value: counts.orders, icon: "◉", href: "/dashboard/orders" },
    { label: "Domínios", value: counts.domains, icon: "◎", href: "/dashboard/domains" },
    { label: "Alojamento", value: counts.hosting, icon: "▣", href: "/dashboard/hosting" },
    { label: "Projectos", value: counts.projects, icon: "◫", href: "/dashboard/projects" },
    { label: "Tickets abertos", value: counts.tickets, icon: "◈", href: "/dashboard/tickets" },
    { label: "Facturas", value: counts.invoices, icon: "▤", href: "/dashboard/invoices" },
  ];

  const cards: Card[] = [
    { label: "Websites", count: counts.projects, icon: "◻", href: "/dashboard/websites" },
    { label: "Domínios", count: counts.domains, icon: "◎", href: "/dashboard/domains" },
    { label: "Alojamento", count: counts.hosting, icon: "▣", href: "/dashboard/hosting" },
    { label: "Projectos", count: counts.projects, icon: "◫", href: "/dashboard/projects" },
  ];

  return (
    <div className="dash-home">
      <div className="dash-welcome">
        <h1>Bem-vindo de volta</h1>
        <p>Aqui está o resumo da sua conta.</p>
      </div>

      <div className="dash-stats">
        {stats.map((stat) => (
          <Link className="dash-stat" href={stat.href} key={stat.label}>
            <span className="dash-stat-icon">{stat.icon}</span>
            <span className="dash-stat-value">{stat.value}</span>
            <span className="dash-stat-label">{stat.label}</span>
          </Link>
        ))}
      </div>

      <div className="dash-cards">
        {cards.map((card) => (
          <Link className="dash-card" href={card.href} key={card.label}>
            <span className="dash-card-icon">{card.icon}</span>
            <strong>{card.count}</strong>
            <span className="dash-card-label">{card.label}</span>
            <span className="dash-card-arrow">↗</span>
          </Link>
        ))}
      </div>

      <CrossSellRecommendations offers={offers} mode="link" title="Próximos passos" />
    </div>
  );
}
