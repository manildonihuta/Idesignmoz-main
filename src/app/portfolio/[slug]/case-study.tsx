"use client";

import Link from "next/link";

import type { Project } from "@/lib/portfolio";

export default function PortfolioCaseStudy({ project }: { project: Project }) {

  const sections: Array<{ label: string; body: string }> = [
    { label: "Challenge", body: project.challenge },
    { label: "Strategy", body: project.strategy },
    { label: "Design", body: project.design },
    { label: "Development", body: project.development },
  ];

  return (
    <main id="main" className="inner-page section-wrap detail-page">
      {/* Hero */}
      <div className="page-hero">
        <p className="eyebrow">
          <span className="pulse" /> {project.industry} · {project.year}
        </p>
        <h1>
          {project.client}<br />
          <em>na prática.</em>
        </h1>
        <p>{project.summary}</p>
      </div>

      {/* Meta bar */}
      <div className="case-meta-grid">
        <div>
          <span className="case-meta-label">Client</span>
          <p>{project.client}</p>
        </div>
        <div>
          <span className="case-meta-label">Industry</span>
          <p>{project.industry}</p>
        </div>
        <div>
          <span className="case-meta-label">Services</span>
          <p>{project.services.join(", ")}</p>
        </div>
        <div>
          <span className="case-meta-label">Year</span>
          <p>{project.year}</p>
        </div>
      </div>

      {/* Project image */}
      <div
        className="case-hero-image"
        style={{ background: project.imageTone }}
      >
        <b>{project.imageLabel}</b>
        <span>{project.client}</span>
      </div>

      {/* Challenge / Strategy / Design / Development */}
      {sections.map((section) => (
        <section className="service-detail-section" key={section.label}>
          <h2>{section.label}</h2>
          <p className="prose-content">{section.body}</p>
        </section>
      ))}

      {/* Technology */}
      <section className="service-detail-section">
        <h2>Technology</h2>
        <div className="tech-tags">
          {project.technology.map((tech) => (
            <span className="tech-tag" key={tech}>{tech}</span>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="service-detail-section">
        <h2>Results</h2>
        <div className="case-results">
          {project.results.map((result) => (
            <div className="case-result" key={result.label}>
              <strong>{result.metric}</strong>
              <span>{result.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="service-cta">
        <div className="flex flex-wrap gap-3">
          {project.url ? (
            <a className="button" href={project.url} target="_blank" rel="noreferrer">
              Visit Website <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          <Link className="outline-button" href="/portfolio">
            Back to portfolio
          </Link>
          <Link className="outline-button" href="/contact">
            Start a project
          </Link>
        </div>
      </section>
    </main>
  );
}