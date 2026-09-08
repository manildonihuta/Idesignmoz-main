"use client";

import * as React from "react";
import Link from "next/link";
import { cx } from "./primitives";

/* ------------------------------------------------------------------ */
/* ServiceCard                                                         */
/* ------------------------------------------------------------------ */

export interface ServiceCardProps {
  number?: string;
  icon?: React.ReactNode;
  title: string;
  copy: string;
  href?: string;
  ctaLabel?: React.ReactNode;
  className?: string;
}

/** Marketing card for a service offering (uses `.service-card` CSS). */
export function ServiceCard({ number, icon, title, copy, href, ctaLabel, className }: ServiceCardProps) {
  const content = (
    <>
      {number != null && <span className="service-number">{number}</span>}
      {icon && <div className="service-icon">{icon}</div>}
      <h3>{title}</h3>
      <p>{copy}</p>
      {href && (
        <Link href={href}>
          {ctaLabel ?? "Explorar"} <span aria-hidden="true">↗</span>
        </Link>
      )}
    </>
  );
  return <article className={cx("service-card", className)}>{content}</article>;
}

/* ------------------------------------------------------------------ */
/* PricingCard                                                         */
/* ------------------------------------------------------------------ */

export interface PricingCardProps {
  title: string;
  description?: string;
  planLabel?: React.ReactNode;
  price: React.ReactNode;
  period?: React.ReactNode;
  note?: React.ReactNode;
  features?: string[];
  cta?: { label: React.ReactNode; href: string };
  actions?: React.ReactNode;
  featured?: boolean;
  popularLabel?: string;
  headingTag?: "h2" | "h3";
  className?: string;
}

/** Marketing pricing tier card (`.price-card` CSS). */
export function PricingCard({
  title,
  description,
  planLabel,
  price,
  period,
  note,
  features = [],
  cta,
  actions,
  featured,
  popularLabel,
  headingTag: Heading = "h3",
  className,
}: PricingCardProps) {
  return (
    <article className={cx("price-card", featured && "featured", className)}>
      {featured && popularLabel && <span className="popular">{popularLabel}</span>}
      {planLabel != null && <span className="plan-label">{planLabel}</span>}
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
      <div className="price">
        <strong>{price}</strong>
        {period != null && <span> {period}</span>}
      </div>
      {note != null && <p className="annual-note">{note}</p>}
      {features.length > 0 && (
        <ul>
          {features.map((f) => (
            <li key={f}>✓ {f}</li>
          ))}
        </ul>
      )}
      {actions ?? (cta && (
        <Link className={featured ? "button" : "outline-button"} href={cta.href}>
          {cta.label}
        </Link>
      ))}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* TestimonialCard                                                     */
/* ------------------------------------------------------------------ */

export interface TestimonialCardProps {
  quote: string;
  name: string;
  role?: string;
  className?: string;
}

/** Marketing testimonial card (`.testimonial-card` CSS). */
export function TestimonialCard({ quote, name, role, className }: TestimonialCardProps) {
  return (
    <blockquote className={cx("testimonial-card", className)}>
      <span className="quote-mark" aria-hidden="true">
        “
      </span>
      <p>{quote}</p>
      <footer>
        <strong>{name}</strong>
        {role && <span>{role}</span>}
      </footer>
    </blockquote>
  );
}

/* ------------------------------------------------------------------ */
/* PortfolioCard                                                       */
/* ------------------------------------------------------------------ */

export interface PortfolioCardProps {
  title: string;
  kind: string;
  image?: React.ReactNode;
  className?: string;
  href?: string;
  wide?: boolean;
}

/** Marketing portfolio case card (`.portfolio-item` CSS). */
export function PortfolioCard({ title, kind, image, className, href, wide }: PortfolioCardProps) {
  return (
    <Link href={href ?? "/portfolio"} className={cx("portfolio-item", wide && "portfolio-wide", className)}>
      {image}
      <div className="portfolio-meta">
        <div>
          <h2>{title}</h2>
          <p>{kind}</p>
        </div>
<span className="portfolio-arrow" aria-hidden="true">↗</span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* HostingCard                                                         */
/* ------------------------------------------------------------------ */

export interface SpecRowProps {
  label: string;
  value: string;
}

export function SpecRow({ label, value }: SpecRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-paper">{value}</span>
    </div>
  );
}

export interface HostingCardProps {
  name: string;
  description?: string;
  badge?: string;
  featured?: boolean;
  price: React.ReactNode;
  priceSuffix?: React.ReactNode;
  priceNote?: React.ReactNode;
  specs?: Array<{ label: string; value: string }>;
  actions?: React.ReactNode;
  headingTag?: "h2" | "h3" | "h4";
  className?: string;
}

/**
 * Generic hosting plan card. Agnostic of the data source — pass any specs
 * and optional actions (e.g. an add-to-cart button).
 */
export function HostingCard({
  name,
  description,
  badge,
  featured,
  price,
  priceSuffix,
  priceNote,
  specs = [],
  actions,
  headingTag: Heading = "h3",
  className,
}: HostingCardProps) {
  return (
    <article
      className={cx(
        "relative flex flex-col rounded-2xl border bg-surface p-6 transition-transform hover:-translate-y-1",
        featured ? "border-brand" : "border-line",
        className,
      )}
    >
      {badge && (
        <span className="absolute right-4 top-4 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">
          {badge}
        </span>
      )}
      <Heading className="font-display-2 text-xl font-semibold tracking-tight">{name.toUpperCase()}</Heading>
      {description && <p className="mt-2 min-h-[40px] text-sm text-muted">{description}</p>}
      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-paper">{price}</span>
          {priceSuffix && <span className="text-xs text-muted">{priceSuffix}</span>}
        </div>
        {priceNote && <p className="mt-1 text-xs text-muted">{priceNote}</p>}
      </div>
      {specs.length > 0 && (
        <div className="my-4 border-t border-line pt-4">
          {specs.map((s) => (
            <SpecRow key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}
      {actions && <div className="mt-auto flex flex-col gap-2">{actions}</div>}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* DomainCard                                                          */
/* ------------------------------------------------------------------ */

export interface DomainCardProps {
  domain: string;
  status?: "available" | "taken" | "pending" | "unknown";
  price?: React.ReactNode;
  renewal?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Result card shown after a domain availability check. */
export function DomainCard({ domain, status = "unknown", price, renewal, actions, className }: DomainCardProps) {
  const badge = {
    available: { label: "DISPONÍVEL", cls: "available" },
    taken: { label: "INDISPONÍVEL", cls: "taken" },
    pending: { label: "A VERIFICAR", cls: "pending" },
    unknown: { label: "—", cls: "" },
  }[status];

  return (
    <div className={cx("domain-result-panel", status === "available" ? "available" : status === "taken" ? "taken" : "", className)}>
      <div className="domain-card-top">
        <strong>{domain}</strong>
        {status !== "unknown" && <span className={`domain-badge ${badge.cls}`}>{badge.label}</span>}
      </div>
      {(price != null || renewal != null) && (
        <dl className="domain-price-page">
          {price != null && (
            <div>
              <dt>Registo</dt>
              <dd>{price}</dd>
            </div>
          )}
          {renewal != null && (
            <div>
              <dt>Renovação</dt>
              <dd>{renewal}</dd>
            </div>
          )}
        </dl>
      )}
      {actions && <div className="domain-card-actions">{actions}</div>}
    </div>
  );
}