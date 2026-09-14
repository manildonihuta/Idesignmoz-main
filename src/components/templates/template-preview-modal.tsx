"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { AiTemplate } from "@/lib/ai-templates";
import { TemplatePreview } from "@/components/templates/template-preview";

const STYLE_LABELS: Record<string, string> = {
  modern: "Moderno",
  minimal: "Minimalista",
  bold: "Arrojado",
  elegant: "Elegante",
  playful: "Divertido",
};

export function TemplatePreviewModal({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  template: AiTemplate | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && template && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Previsualizar ${template.name}`}
        >
          <motion.div
            key="overlay"
            className="absolute inset-0 rounded-sm bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            role="document"
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--ai-border)] bg-[var(--ai-surface)] shadow-2xl"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {/* preview area */}
            <div className="h-72 flex-none overflow-hidden sm:h-[400px]">
              <TemplatePreview
                name={template.name}
                colors={template.colors}
                image={template.images.hero}
              />
            </div>

            {/* info */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ai-badge">{template.industryLabel}</span>
                <span className="ai-badge">{template.pages} páginas</span>
                <span className="ai-badge">{STYLE_LABELS[template.style] ?? template.style}</span>
              </div>

              <div>
                <h2 className="ai-display text-2xl md:text-3xl" style={{ marginTop: 0 }}>
                  {template.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ai-muted)]">
                  {template.description}
                </p>
              </div>

              {/* colour strip */}
              <div className="flex items-center gap-2 pt-1">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ background: template.colors.from }}
                />
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ background: template.colors.to }}
                />
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ background: template.colors.accent }}
                />
                <span className="ml-1 text-xs text-[var(--ai-muted)]">Cores do modelo</span>
              </div>

              <div className="mt-auto flex flex-wrap justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="ai-btn ai-btn-ghost !px-5 !py-2.5 text-sm"
                >
                  Fechar
                </button>
                <Link
                  href={`/dashboard/ai-builder/new?template=${template.id}`}
                  className="ai-btn !px-5 !py-2.5 text-sm"
                >
                  ⚡ Usar este modelo
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
