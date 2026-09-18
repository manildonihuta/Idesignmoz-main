"use client";

import Link from "next/link";

import type { CrossSellOffer } from "@/lib/catalog-types";
import { CrossSellRecommendations } from "@/components/cross-sell-recommendations";
import { AnalyticsLineChart } from "@/components/ui/analytics-line-chart";

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
    <div className="dash-home space-y-6">
      <div className="dash-welcome">
        <h1>Bem-vindo de volta</h1>
        <p>Aqui está o resumo da sua conta e atividade dos seus serviços.</p>
      </div>

      <div className="my-4">
        <AnalyticsLineChart
          title="Uso de Tráfego & Recursos dos Seus Serviços"
          totalValue={`${(counts.hosting * 12.4 + counts.domains * 2.8 + 15.2).toFixed(1)} GB / mês`}
          changePercentage="+18.5%"
          periodLabel="Últimos 30 dias"
          statsLabel1="Serviços Ativos:"
          statsValue1={`${counts.hosting + counts.domains + counts.projects} ativos`}
          highValue="45.2 GB"
          lowValue="4.8 GB"
          changeValue="+15.4%"
          color="#d9ff53"
          data={[
            { date: '1 Set', value: 320 },
            { date: '5 Set', value: 480 },
            { date: '10 Set', value: 720 },
            { date: '15 Set', value: 650 },
            { date: '20 Set', value: 890 },
            { date: '25 Set', value: 1120 },
            { date: '30 Set', value: 1350 },
          ]}
        />
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
