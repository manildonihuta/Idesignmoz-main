"use client";

import Link from "next/link";
import { useState } from "react";

import { formatMZN100 } from "@/lib/currency";
import type { PricingCategory, PricingEntry } from "@/lib/pricing-plans";
import { CatalogAddButton } from "@/components/catalog-add-button";
import { PricingCard } from "@/components/ui/core";

export default function PricingMarketplace({
  plans,
  categories,
  annualDiscount,
  pricingToCatalog,
}: {
  plans: PricingEntry[];
  categories: PricingCategory[];
  annualDiscount: number;
  pricingToCatalog: Record<string, string>;
}) {
  const [category, setCategory] = useState<PricingCategory>(categories[0] ?? "Websites");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const visible = plans.filter((plan) => plan.category === category);

  return (
    <main id="main" className="inner-page section-wrap">
      <div className="page-hero page-hero-split">
        <div>
          <p className="eyebrow">
            <span className="pulse" /> Preços que fazem sentido
          </p>
          <h1>
            Invest in the<br />
            <em>next step.</em>
          </h1>
        </div>
        <p>
          Clear starting points for ambitious teams. Every project is shaped to
          your goals.
        </p>
      </div>

      {/* Category tabs */}
      <nav
        className="filter-row pricing-tabs"
        aria-label="Categoria de preços"
      >
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {/* Billing toggle */}
      <div className="billing-toggle">
        <span className={billing === "monthly" ? "active" : ""}>Monthly</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={billing === "yearly"}
            onChange={(event) =>
              setBilling(event.target.checked ? "yearly" : "monthly")
            }
          />
          <span className="slider" />
        </label>
        <span className={billing === "yearly" ? "active" : ""}>
          Yearly
          <em className="discount-badge">-{annualDiscount}%</em>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {visible.map((plan) => {
          const isSingle = plan.unit === "pagamento único";
          const isYearly = !isSingle && billing === "yearly";
          const yearlyTotal = Math.round(plan.monthly * 12 * (1 - annualDiscount / 100));
          const showPrice = isYearly ? yearlyTotal : plan.monthly;
          return (
            <PricingCard
              key={`${category}-${plan.name}`}
              headingTag="h2"
              title={plan.name}
              planLabel={plan.description}
              price={formatMZN100(showPrice)}
              period={
                `MT ${isSingle ? "pagamento único" : isYearly ? "por ano" : `por ${plan.unit}`}`
              }
              note={isYearly && annualDiscount > 0 ? `Poupe ${annualDiscount}% vs. mensal` : undefined}
              features={plan.features}
              featured={plan.featured}
              popularLabel={plan.badge ?? "Recomendado"}
              actions={(() => {
                const productId = pricingToCatalog[plan.name];
                if (productId) {
                  return (
                    <div className="flex flex-col gap-2">
                      <CatalogAddButton
                        productId={productId}
                        className={plan.featured ? "button" : "outline-button"}
                      />
                      <Link className="text-sm text-lime hover:opacity-80 text-center" href={plan.href}>
                        Ver detalhes <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  );
                }
                return (
                  <Link
                    className={plan.featured ? "button" : "outline-button"}
                    href={plan.href}
                  >
                    {plan.cta} <span aria-hidden="true">↗</span>
                  </Link>
                );
              })()}
            />
          );
        })}
      </div>
    </main>
  );
}