"use client";

import Link from "next/link";
import { useState } from "react";

import type { Service, ServiceCategory } from "@/lib/services";

const ALL = "All" as const;

export default function ServicesMarketplace({ services }: { services: Service[] }) {
  const [active, setActive] = useState<ServiceCategory | "All">(ALL);
  const categories = Array.from(new Set(services.map((s) => s.category)));
  const visible = active === ALL ? services : services.filter((s) => s.category === active);

  return (
    <main id="main" className="inner-page section-wrap">
      <div className="page-hero">
        <p className="eyebrow"><span className="pulse" /> A próxima decisão digital</p>
        <h1>Services with<br /><em>substance.</em></h1>
        <p>Strategy, design and technology for businesses building their next chapter.</p>
      </div>

      <nav className="filter-row pricing-tabs" aria-label="Categorias de serviços">
        <button
          type="button"
          className={active === ALL ? "active" : ""}
          onClick={() => setActive(ALL)}
        >
          {ALL}
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={active === category ? "active" : ""}
            onClick={() => setActive(category)}
          >
            {category}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((service, index) => (
          <Link
            key={service.slug}
            className="catalog-card"
            href={`/services/${service.slug}`}
          >
            <span>0{index + 1}</span>
            <h2>{service.title}</h2>
            <p>{service.description}</p>
            <b>
              {service.ctaLabel === "Start Project" ? "Start Project" : "Explore"}{" "}
              <span aria-hidden="true">↗</span>
            </b>
          </Link>
        ))}
      </div>
    </main>
  );
}