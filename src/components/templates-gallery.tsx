import Link from "next/link";

import { AI_TEMPLATES } from "@/lib/ai-templates";

export function TemplatesGallery() {
  return (
    <>
      <section className="page-hero">
        <div className="eyebrow">
          <span className="pulse" />
          IDesign AI Builder
        </div>
        <h1>
          Modelos de <span className="ai-gradient-text">design</span>
        </h1>
        <p>
          Escolha um ponto de partida inspirador. A inteligência artificial
          adapta o modelo ao seu negócio — textos, páginas e estilo em
          português de Moçambique.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/dashboard/ai-builder/new">
            Começar do zero <span>→</span>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {AI_TEMPLATES.map((template) => (
          <article
            key={template.id}
            className="ai-font flex flex-col overflow-hidden rounded-2xl border border-[var(--ai-border)] bg-[var(--ai-surface)] transition-colors hover:border-[var(--ai-border-strong)]"
          >
            <div
              className="relative h-44 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${template.colors.from} 0%, ${template.colors.to} 60%, ${template.colors.accent} 120%)`,
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,.28),transparent_55%)]" />
              <span className="ai-display absolute bottom-4 left-5 right-5 text-3xl text-white/95">
                {template.name}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ai-badge">{template.industryLabel}</span>
                <span className="ai-badge">{template.pages} páginas</span>
              </div>
              <div>
                <h2 className="ai-display text-xl">{template.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ai-muted)]">
                  {template.description}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-5 w-5 rounded-full border border-white/20"
                    style={{ background: template.colors.from }}
                  />
                  <span
                    className="h-5 w-5 rounded-full border border-white/20"
                    style={{ background: template.colors.to }}
                  />
                  <span
                    className="h-5 w-5 rounded-full border border-white/20"
                    style={{ background: template.colors.accent }}
                  />
                </div>
                <Link
                  className="ai-btn !px-4 !py-2 text-xs"
                  href={`/dashboard/ai-builder/new?template=${template.id}`}
                >
                  ⚡ Usar este modelo
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-24 grid grid-cols-1 items-end gap-6 border-t border-[var(--line)] pt-16 md:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="eyebrow">
            <span className="pulse" />
            Nenhum modelo serve?
          </div>
          <h2 style={{ marginTop: 24, marginBottom: 0 }}>Crie do zero</h2>
        </div>
        <div>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Pode descrever o seu negócio em palavras e deixar que a IA
            construa algo único para si — sem limites de modelo, sem
            templates impostos.
          </p>
          <Link className="ai-btn mt-6" href="/dashboard/ai-builder/new">
            ✨ Criar do zero
          </Link>
        </div>
      </section>
    </>
  );
}