"use client";

import Link from "next/link";

import type { CrossSellOffer } from "@/lib/catalog-types";
import { CATEGORY_ICON } from "@/lib/catalog-types";
import { CatalogAddButton } from "@/components/catalog-add-button";

function offerKey(offer: CrossSellOffer): string {
  return `${offer.category}-${offer.productId}`;
}

/**
 * Renders a list of cross-sell offers. When `mode="cart"` (e.g. on the
 * post-purchase confirmation) each offer has an "Add to cart" button; when
 * `mode="link"` (e.g. in the client dashboard) offers link out to the product.
 */
export function CrossSellRecommendations({
  offers,
  mode,
  title = "Complete a sua presença",
}: {
  offers: CrossSellOffer[];
  mode: "cart" | "link";
  title?: string;
}) {
  if (offers.length === 0) {
    return null;
  }
  return (
    <div className="cross-sell">
      <h3 className="cross-sell-title">{title}</h3>
      <div className="cross-sell-grid">
        {offers.map((offer) => (
          <article className="cross-sell-card" key={offerKey(offer)}>
            <span className="cross-sell-eyebrow">
              {CATEGORY_ICON[offer.category]} {offer.eyebrow}
            </span>
            <h4>{offer.headline}</h4>
            <p>{offer.body}</p>
            {mode === "cart" ? (
              <div className="cross-sell-actions">
                <CatalogAddButton productId={offer.productId} className="outline-button" />
                <Link className="text-sm text-lime hover:opacity-80" href={offer.href}>
                  Ver detalhes <span aria-hidden="true">↗</span>
                </Link>
              </div>
            ) : (
              <Link className="outline-button" href={offer.href}>
                Ver mais <span aria-hidden="true">↗</span>
              </Link>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}