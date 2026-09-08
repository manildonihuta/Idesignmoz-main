"use client";

import { useState } from "react";

import HostingCard from "@/components/hosting-card";
import type { HostingCategory, HostingPlan } from "@/lib/hosting-plans";

type HostingCategoryOption = { slug: HostingCategory; label: string };

export default function HostingMarketplace({
  plans,
  categories,
}: {
  plans: HostingPlan[];
  categories: HostingCategoryOption[];
}) {
  const [active, setActive] = useState<HostingCategory>(categories[0]?.slug ?? "shared");
  const visible = plans.filter((p) => p.category === active);

  return (
    <main id="main" className="inner-page section-wrap">
      <div className="page-hero page-hero-split">
        <div>
          <p className="eyebrow">
            <span className="pulse" /> Alojamento, sem complicações
          </p>
          <h1>
            O seu website<br />
            merece uma<br />
            <em>boa casa.</em>
          </h1>
        </div>
        <p>
          Infra-estrutura fiável, suporte local e custos transparentes em
          Meticais. Escolha uma categoria e um plano para avançar.
        </p>
      </div>

      <nav className="filter-row pricing-tabs" aria-label="Categorias de alojamento">
        {categories.map((category) => (
          <button
            key={category.slug}
            type="button"
            onClick={() => setActive(category.slug)}
            className={active === category.slug ? "active" : ""}
          >
            {category.label}
          </button>
        ))}
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((plan) => (
          <HostingCard key={plan.slug} plan={plan} />
        ))}
      </div>

      <div className="hosting-note">
        <span className="status-dot" /> Todos os planos incluem SSL, backups e suporte humano em Maputo. 
        Valores em Meticais (MT). Quer algo à medida? Fale connosco.
      </div>
    </main>
  );
}