"use client";

import { useState } from "react";

import type { ClientProject } from "@/lib/client-data";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-MZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const STAGES = [
  { id: "brief", label: "Briefing" },
  { id: "design", label: "Design" },
  { id: "development", label: "Desenvolvimento" },
  { id: "review", label: "Revisão" },
  { id: "testing", label: "Testes" },
  { id: "launch", label: "Lançamento" },
];

function computeProgress(p: ClientProject): number {
  if (!p.tasks.length) return p.status === "published" || p.status === "done" ? 100 : 0;
  const done = p.tasks.filter((t) => t.status === "done").length;
  return Math.round((done / p.tasks.length) * 100);
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Em curso",
  archived: "Arquivado",
  brief: "Em briefing",
  active: "Em curso",
  on_hold: "Em pausa",
  done: "Concluído",
  cancelled: "Cancelado",
};

function ProjectCard({
  project,
  onSelect,
}: {
  project: ClientProject;
  onSelect: () => void;
}) {
  const progress = computeProgress(project);
  const statusLabel = STATUS_LABEL[project.status] ?? project.status;

  return (
    <article className="project-card" onClick={onSelect}>
      <div className="project-card-head">
        <div>
          <span className="order-label">{project.id.slice(0, 8).toUpperCase()}</span>
          <h3>{project.title}</h3>
        </div>
        <span className={`project-status ${project.status}`}>{statusLabel}</span>
      </div>
      <div className="project-card-info">
        <div>
          <dt>Prazo</dt>
          <dd>{fmtDate(project.deadline)}</dd>
        </div>
        {project.category ? (
          <div>
            <dt>Categoria</dt>
            <dd>{project.category}</dd>
          </div>
        ) : null}
        {project.budget != null ? (
          <div>
            <dt>Orçamento</dt>
            <dd>{project.budget.toLocaleString("pt-MZ")} MT</dd>
          </div>
        ) : null}
        <div>
          <dt>Tarefas</dt>
          <dd>{project.tasks.length}</dd>
        </div>
      </div>
      <div className="project-progress">
        <div className="project-progress-head">
          <span>Progress</span>
          <b>{progress}%</b>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </article>
  );
}

export function ProjectsView({ projects }: { projects: ClientProject[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? projects.find((p) => p.id === selectedId) : undefined;

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="project-detail-head">
          <button className="outline-button" type="button" onClick={() => setSelectedId(null)}>
            ← Voltar
          </button>
          <div>
            <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
              {selected.title}
            </h1>
            <p className="text-muted">
              {selected.category ?? "Projeto"} · Prazo {fmtDate(selected.deadline)}
            </p>
          </div>
        </div>

        <div className="timeline">
          {STAGES.map((stage) => {
            const stageTask = selected.tasks.find((t) =>
              t.title.toLowerCase().includes(stage.label.toLowerCase()),
            );
            const status = stageTask?.status ?? "todo";
            return (
              <div key={stage.id} className={`timeline-stage ${status}`}>
                <span className="timeline-dot">
                  {status === "done" ? "●" : status === "in_progress" ? "◔" : "○"}
                </span>
                <span className="timeline-label">{stage.label}</span>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Tarefas</h3>
          <div className="space-y-2">
            {selected.tasks.length === 0 && (
              <p className="text-sm text-muted">Sem tarefas definidas.</p>
            )}
            {selected.tasks.map((task) => (
              <div className="flex items-center justify-between border-b border-line/60 pb-2" key={task.id}>
                <div>
                  <p className="text-sm text-paper">{task.title}</p>
                  {task.description ? (
                    <p className="text-xs text-muted">{task.description}</p>
                  ) : null}
                </div>
                <span className={`site-status ${task.status === "done" ? "live" : task.status === "in_progress" ? "dev" : "off"}`}>
                  {task.status === "done" ? "Concluída" : task.status === "in_progress" ? "Em curso" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Comentários</h3>
          {selected.comments.length === 0 ? (
            <p className="text-sm text-muted">Sem comentários ainda.</p>
          ) : (
            <ul className="space-y-2">
              {selected.comments.map((c) => (
                <li key={c.id} className="text-sm text-muted">
                  <span className="text-paper">{fmtDate(c.createdAt)}:</span> {c.body}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Projectos
        </h1>
        <p className="text-muted">Gestão dos seus projetos de website, design e software.</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {projects.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não tem projetos.
          </div>
        )}
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onSelect={() => setSelectedId(project.id)}
          />
        ))}
      </div>
    </div>
  );
}
