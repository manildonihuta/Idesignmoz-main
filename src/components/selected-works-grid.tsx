"use client";

import React from "react";
import Link from "next/link";
import ParallaxCarousel, { type ParallaxCarouselItem } from "@/components/ui/parallax-carousel";
import type { Project } from "@/lib/portfolio";

const defaultCarouselItems: ParallaxCarouselItem[] = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop",
    title: "Logística Moçambique",
    subtitle: "Gestão de frotas e faturação integrada",
    category: "Logística & E-Commerce",
    description: "Plataforma corporativa para gestão de frotas e rastreio em tempo real com portal de clientes.",
    link: "/portfolio",
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=800&auto=format&fit=crop",
    title: "Kanimambo Tech",
    subtitle: "Identidade de marca & presenças digitais",
    category: "Branding & Startup",
    description: "Identidade visual expressiva, sistema de design e portal web para ecossistema de startups.",
    link: "/portfolio",
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop",
    title: "Maputo Digital Hub",
    subtitle: "Gestão de alojamento e infraestrutura DNS",
    category: "SaaS & Cloud",
    description: "Painel unificado de gestão de domínios, instâncias cloud e monitorização em tempo real.",
    link: "/portfolio",
  },
  {
    id: 4,
    image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?q=80&w=1200&auto=format&fit=crop",
    title: "Agro Moz Export",
    subtitle: "Vendas online com M-Pesa & e-Mola",
    category: "E-Commerce & Pagamentos",
    description: "Loja online otimizada para conversão com integração nativa de carteiras móveis moçambicanas.",
    link: "/portfolio",
  },
  {
    id: 5,
    image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1200&auto=format&fit=crop",
    title: "IDesign Moz Engine",
    subtitle: "Gerador de websites com Inteligência Artificial",
    category: "AI Website Builder",
    description: "Criador automático de estruturas, cópias e layouts profissionais em menos de 60 segundos.",
    link: "/portfolio",
  },
];

export function SelectedWorksGrid({ projects }: { projects?: Project[] }) {
  const items: ParallaxCarouselItem[] =
    projects && projects.length > 0
      ? projects.slice(0, 6).map((p, idx) => ({
          id: p.slug || idx + 1,
          image:
            p.image && (p.image.startsWith("http") || p.image.startsWith("/"))
              ? p.image
              : defaultCarouselItems[idx % defaultCarouselItems.length].image,
          title: p.client,
          subtitle: p.summary,
          category: p.industry || p.categories?.[0] || "Web Design",
          description: p.summary,
          link: p.url || "/portfolio",
        }))
      : defaultCarouselItems;

  return (
    <section className="work-section section-wrap" id="work" aria-label="Trabalhos seleccionados">
      <div className="section-kicker">
        <span>04</span>
        <span className="rule" />
        <span>Trabalhos seleccionados</span>
      </div>

      <div className="work-heading mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-paper md:text-4xl">
            Feito em Moçambique. <em className="not-italic text-brand">Construído para o mundo.</em>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Explore o carrossel interativo com efeito de paralaxe e arrasto manual.
          </p>
        </div>

        <Link className="text-link text-sm font-semibold text-brand hover:underline" href="/portfolio">
          Ver todos os trabalhos ↗
        </Link>
      </div>

      <div className="w-full">
        <ParallaxCarousel items={items} autoPlay={true} interval={6000} />
      </div>
    </section>
  );
}
