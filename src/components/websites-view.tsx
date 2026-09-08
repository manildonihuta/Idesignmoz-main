"use client";

import Link from "next/link";

import type { ClientProject } from "@/lib/client-data";

export function WebsitesView({ projects }: { projects: ClientProject[] }) {
  const websites = projects.filter((p) => p.category !== "domain" && p.category !== "hosting");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Websites
        </h1>
        <p className="text-muted">Os websites geridos por esta conta.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {websites.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não tem websites associados a esta conta.
          </div>
        )}
        {websites.map((site) => (
          <article className="website-card" key={site.id}>
            <div className="website-card-head">
              <div className="website-favicon">{site.title.charAt(0)}</div>
              <div>
                <h3>{site.title}</h3>
                <p className="website-url">{site.category ?? "Projeto"}</p>
              </div>
              <span className={`site-status ${site.status === "published" ? "live" : "dev"}`}>
                {site.status === "published" ? "Live" : "Em desenvolvimento"}
              </span>
            </div>
            <div className="website-meta">
              <div>
                <span className="order-label">Tarefas</span>
                <p>{site.tasks.length}</p>
              </div>
              <div>
                <span className="order-label">Orçamento</span>
                <p>{site.budget != null ? `${site.budget.toLocaleString("pt-MZ")} MT` : "—"}</p>
              </div>
              <div>
                <span className="order-label">Comentários</span>
                <p>{site.comments.length}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="email-plan-actions">
        <Link className="button" href="/dashboard/ai-builder">
          Criar site com IA ↗
        </Link>
        <Link className="outline-button" href="/services/web-development">
          Estender plano ↗
        </Link>
        <Link className="outline-button" href="/dashboard/projects">
          Ver projeto ↗
        </Link>
      </div>
    </div>
  );
}
