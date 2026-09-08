"use client";

import { useState } from "react";

import { findCatalogProduct, useCatalog } from "@/lib/catalog-client";
import { sellPeriodLabel, type SellPeriod } from "@/lib/catalog-types";
import { addCatalogToCart, catalogPrice } from "@/lib/cart";
import { trackEvent } from "@/lib/analytics-client";

function fmt(price: number): string {
  return new Intl.NumberFormat("pt-MZ").format(price);
}

/**
 * Reusable "Adicionar ao carrinho" button for any CatalogProduct loaded from
 * the DB-backed client catalog. Recurring products expose a monthly/annual
 * billing toggle.
 */
export function CatalogAddButton({
  productId,
  className = "button",
}: {
  productId: string;
  className?: string;
}) {
  const { data: catalog } = useCatalog();
  const product = catalog ? findCatalogProduct(productId, catalog.products) : undefined;
  const [period, setPeriod] = useState<SellPeriod>(
    product?.type === "recurring" ? "monthly" : "one_time",
  );
  const [domain, setDomain] = useState("");
  const [added, setAdded] = useState(false);

  if (!product) {
    return null;
  }
  const prod = product;

  const recurring = prod.type === "recurring";
  const price = catalogPrice(prod, period);
  const needsDomain = prod.category === "hosting" || prod.category === "email";

  function onAdd() {
    const fullDomain = domain.trim().toLowerCase();
    if (needsDomain && !fullDomain) {
      return;
    }
    addCatalogToCart(prod, period, { fullDomain });
    setAdded(true);
    trackEvent({
      event: "cart_add",
      page: window.location.pathname,
      value: price,
      meta: { productId: prod.id, period, hasDomain: Boolean(fullDomain) },
    });
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="catalog-add">
      {recurring ? (
        <>
          <div className="catalog-periods" role="group" aria-label="Período de facturação">
            <button
              type="button"
              className={period === "monthly" ? "active" : ""}
              onClick={() => setPeriod("monthly")}
            >
              Mensal
            </button>
            <button
              type="button"
              className={period === "quarterly" ? "active" : ""}
              onClick={() => setPeriod("quarterly")}
            >
              Trimestral
            </button>
            <button
              type="button"
              className={period === "semiannual" ? "active" : ""}
              onClick={() => setPeriod("semiannual")}
            >
              Semestral
            </button>
            <button
              type="button"
              className={period === "annual" ? "active" : ""}
              onClick={() => setPeriod("annual")}
            >
              Anual
            </button>
          </div>
          <p className="text-xs text-muted">
            {period === "monthly" && "Facturação mensal — cancele quando quiser."}
            {period === "quarterly" && "Facturação trimestral — melhores condições por ciclo."}
            {period === "semiannual" && "Facturação semestral — mais benefícios semestrais."}
            {period === "annual" && "Facturação anual — poupe face ao mensal."}
          </p>
        </>
      ) : null}
      {needsDomain ? (
        <label className="catalog-domain-field">
          <span className="text-xs text-muted">Domínio para o alojamento *</span>
          <input
            type="text"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="exemplo.com"
            autoComplete="off"
          />
        </label>
      ) : null}
      <button type="button" className={className} onClick={onAdd}>
        {added
          ? "Adicionado ✓"
          : `Adicionar · ${fmt(price)} MT${recurring ? `/${period === "annual" ? "ano" : period === "quarterly" ? "trimestre" : period === "semiannual" ? "semestre" : "mês"}` : ""}`}
        <span className="sr-only">{sellPeriodLabel(period)}</span>
      </button>
    </div>
  );
}