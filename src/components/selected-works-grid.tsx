"use client";

import React from "react";
import Link from "next/link";
import { LayoutGrid, type Card } from "@/components/ui/layout-grid";
import type { Project } from "@/lib/portfolio";

const fallbackThumbnails = [
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?q=80&w=1200&auto=format&fit=crop",
];

const SkeletonOne = () => {
  return (
    <div className="flex flex-col gap-2">
      <span className="w-fit rounded-full bg-brand/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand backdrop-blur-md">
        Logística & E-Commerce · 2026
      </span>
      <p className="text-2xl font-bold text-white md:text-3xl">Logística Moçambique</p>
      <p className="max-w-lg text-sm text-neutral-200">
        Plataforma corporativa para gestão de frotas e rastreio em tempo real, com portal de faturação integrada e suporte local.
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand">
        <span>Serviços: Website / Alojamento Cloud / API</span>
      </div>
    </div>
  );
};

const SkeletonTwo = () => {
  return (
    <div className="flex flex-col gap-2">
      <span className="w-fit rounded-full bg-brand/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand backdrop-blur-md">
        Tecnologia · 2025
      </span>
      <p className="text-xl font-bold text-white md:text-2xl">Kanimambo Tech</p>
      <p className="max-w-sm text-sm text-neutral-200">
        Identidade visual, sistema de design e presença web para ecossistema de startups em Maputo.
      </p>
      <div className="mt-1 text-xs font-semibold text-brand">
        <span>Serviços: Branding / UI/UX</span>
      </div>
    </div>
  );
};

const SkeletonThree = () => {
  return (
    <div className="flex flex-col gap-2">
      <span className="w-fit rounded-full bg-brand/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand backdrop-blur-md">
        SaaS & Cloud · 2026
      </span>
      <p className="text-xl font-bold text-white md:text-2xl">Maputo Digital Hub</p>
      <p className="max-w-sm text-sm text-neutral-200">
        Painel de gestão de domínios, instâncias de alojamento e zonas de DNS de alta disponibilidade.
      </p>
      <div className="mt-1 text-xs font-semibold text-brand">
        <span>Serviços: Plataforma SaaS / DNS</span>
      </div>
    </div>
  );
};

const SkeletonFour = () => {
  return (
    <div className="flex flex-col gap-2">
      <span className="w-fit rounded-full bg-brand/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand backdrop-blur-md">
        Agroindústria & Vendas · 2025
      </span>
      <p className="text-2xl font-bold text-white md:text-3xl">Agro Moz Export</p>
      <p className="max-w-lg text-sm text-neutral-200">
        Loja online integrada com pagamentos móveis (M-Pesa e e-Mola) e envio automático de recibos fiscais.
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand">
        <span>Serviços: Loja Online / M-Pesa API</span>
      </div>
    </div>
  );
};

const defaultCards: Card[] = [
  {
    id: 1,
    content: <SkeletonOne />,
    className: "md:col-span-2",
    thumbnail: fallbackThumbnails[0],
  },
  {
    id: 2,
    content: <SkeletonTwo />,
    className: "col-span-1",
    thumbnail: fallbackThumbnails[1],
  },
  {
    id: 3,
    content: <SkeletonThree />,
    className: "col-span-1",
    thumbnail: fallbackThumbnails[2],
  },
  {
    id: 4,
    content: <SkeletonFour />,
    className: "md:col-span-2",
    thumbnail: fallbackThumbnails[3],
  },
];

function projectToCard(project: Project, index: number): Card {
  const isWide = index % 3 === 0 || index % 3 === 3;
  const cardClassName = isWide ? "md:col-span-2" : "col-span-1";

  const thumbnail =
    project.image && (project.image.startsWith("http") || project.image.startsWith("/"))
      ? project.image
      : fallbackThumbnails[index % fallbackThumbnails.length];

  return {
    id: index + 1,
    className: cardClassName,
    thumbnail,
    url: project.url,
    content: (
      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-brand/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand backdrop-blur-md">
          {project.industry || project.categories?.[0] || "Projeto"} · {project.year || "2026"}
        </span>
        <p className="text-2xl font-bold text-white md:text-3xl">{project.client}</p>
        <p className="max-w-lg text-sm text-neutral-200">{project.summary}</p>
        {project.services && project.services.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand">
            <span>Serviços: {Array.isArray(project.services) ? project.services.join(" / ") : project.services}</span>
          </div>
        )}
      </div>
    ),
  };
}

export function SelectedWorksGrid({ projects }: { projects?: Project[] }) {
  const cards: Card[] =
    projects && projects.length > 0
      ? projects.slice(0, 6).map((p, idx) => projectToCard(p, idx))
      : defaultCards;

  return (
    <section className="work-section section-wrap" id="work" aria-label="Trabalhos seleccionados">
      <div className="section-kicker">
        <span>04</span>
        <span className="rule" />
        <span>Trabalhos seleccionados</span>
      </div>

      <div className="work-heading mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-paper md:text-4xl">
            Feito em Moçambique. <em className="not-italic text-brand">Construído para o mundo.</em>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Projetos reais desenvolvidos para clientes locais e internacionais com tecnologias modernas.
          </p>
        </div>

        <Link className="text-link text-sm font-semibold text-brand hover:underline" href="/portfolio">
          Ver todos os trabalhos ↗
        </Link>
      </div>

      <div className="min-h-[600px] w-full rounded-2xl border border-line bg-surface/50 py-4">
        <LayoutGrid cards={cards} />
      </div>
    </section>
  );
}

