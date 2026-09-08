"use client";

import Link from "next/link";

import type { Service } from "@/lib/services";
import { CATEGORY_ICON, type CatalogProduct } from "@/lib/catalog-types";
import { CatalogAddButton } from "@/components/catalog-add-button";

export default function ServiceDetailPage({
  service,
  cartableProducts,
}: {
  service: Service;
  cartableProducts: CatalogProduct[];
}) {

  return (
    <main id="main" className="inner-page section-wrap detail-page">
      {/* Hero */}
      <div className="page-hero">
        <p className="eyebrow">
          <span className="pulse" /> {service.category} · IDesign Moz
        </p>
        <h1>
          {service.title}<br />
          <em>com propósito.</em>
        </h1>
        <p>{service.hero}</p>
      </div>

      {/* Description */}
      <section className="service-detail-section">
        <div className="section-kicker"><span>Overview</span></div>
        <div className="prose-content">
          <p className="text-lg leading-relaxed">{service.intro}</p>
          <p className="mt-4 text-muted">{service.description}</p>
        </div>
      </section>

      {/* Features */}
      <section className="service-detail-section">
        <h2>Features</h2>
        <div className="check-grid">
          {service.features.map((feature) => (
            <div className="check-item" key={feature}>
              <span className="result-check">✓</span>
              {feature}
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="service-detail-section">
        <h2>Process</h2>
        <div className="process-grid">
          {service.process.map((step) => (
            <div className="process-step" key={step.step}>
              <span className="service-number">{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Deliverables */}
      <section className="service-detail-section">
        <h2>Deliverables</h2>
        <ul className="deliverables-list">
          {service.deliverables.map((item) => (
            <li key={item}><span className="rule" /> {item}</li>
          ))}
        </ul>
      </section>

      {/* Technologies */}
      <section className="service-detail-section">
        <h2>Technologies</h2>
        <div className="tech-tags">
          {service.technologies.map((tech) => (
            <span className="tech-tag" key={tech}>{tech}</span>
          ))}
        </div>
      </section>

      {/* Portfolio Examples */}
      {service.portfolioSlugs && service.portfolioSlugs.length > 0 ? (
        <section className="service-detail-section">
          <h2>Portfolio Examples</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {service.portfolioSlugs.map((p) => (
              <Link className="catalog-card" key={p} href="/portfolio">
                <span>Portfolio</span>
                <h3>{p}</h3>
                <p>Exemplo de trabalho real.</p>
                <b>Ver projecto <span aria-hidden="true">↗</span></b>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Pricing */}
      <section className="service-detail-section">
        <h2>Pricing</h2>
        {cartableProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
            {cartableProducts.map((product) => (
              <article className="price-card" key={product.id}>
                <span className="plan-label">
                  {CATEGORY_ICON[product.category]} {product.category}
                </span>
                <h2 className="mt-1 text-xl">{product.name}</h2>
                <div className="price">
                  <strong>{product.price.toLocaleString("pt-PT")}</strong>
                  <span>
                    MT {product.type === "one_time" ? "pagamento único" : "por mês"}
                  </span>
                </div>
                <p className="text-sm text-muted mb-4">{product.description}</p>
                <CatalogAddButton productId={product.id} className="outline-button" />
              </article>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {service.pricing.map(({ tier, note }) => (
            <article className="price-card" key={tier.name}>
              <span className="plan-label">{tier.name}</span>
              <div className="price">
                <strong>{tier.price}</strong>
                {tier.period ? <span> {tier.period}</span> : null}
              </div>
              {note ? <p className="text-sm text-muted">{note}</p> : null}
              <ul>
                {tier.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="service-detail-section">
        <h2>FAQ</h2>
        <div className="faq-list">
          {service.faqs.map((faq) => (
            <details className="faq-item" key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="service-cta">
        <h2>Ready to start?</h2>
        <p className="text-muted">
          Vamos conversar sobre o seu projecto e encontrar a melhor solução.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="button" href="/contact">
            {service.ctaLabel}{" "}
            <span aria-hidden="true">↗</span>
          </Link>
          <Link className="outline-button" href="/services">
            Back to services
          </Link>
        </div>
      </section>
    </main>
  );
}