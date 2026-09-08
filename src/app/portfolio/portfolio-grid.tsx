"use client";

import { useState } from "react";

import type { Project, ProjectCategory } from "@/lib/portfolio";
import { PortfolioCard } from "@/components/ui/core";

const ALL = "All" as const;

export default function PortfolioGrid({ projects }: { projects: Project[] }) {
  const [active, setActive] = useState<ProjectCategory | "All">(ALL);
  const categories = Array.from(new Set(projects.flatMap((p) => p.categories)));
  const visible = active === ALL ? projects : projects.filter((p) => p.categories.includes(active));

  return (
    <main id="main" className="inner-page section-wrap">
      <div className="page-hero">
        <p className="eyebrow">
          <span className="pulse" /> Trabalhos seleccionados
        </p>
        <h1>
          Good work<br />
          <em>travels far.</em>
        </h1>
        <p>
          Projects for people and businesses leaving their mark, from Mozambique
          to the world.
        </p>
      </div>

      <nav className="filter-row pricing-tabs" aria-label="Filtrar portfólio">
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

      <div className="portfolio-grid">
        {visible.map((project) => (
          <PortfolioCard
            key={project.slug}
            href={`/portfolio/${project.slug}`}
            title={project.client}
            kind={`${project.industry} · ${project.services.join(" · ")}`}
            wide={project.categories.includes("Apps")}
            image={
              <div
                className="portfolio-art"
                style={{ background: project.imageTone }}
              >
                <span>{project.year}</span>
                <b className="portfolio-art-label">{project.imageLabel}</b>
              </div>
            }
          />
        ))}
      </div>
    </main>
  );
}