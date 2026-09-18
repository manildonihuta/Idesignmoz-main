"use client";

import Link from "next/link";
import { useState } from "react";

import {
  parseSectionsInput,
  type ParsedSection,
  type Section,
} from "@/lib/ai/builder-schema";
import type { BuilderPage, BuilderSite } from "@/services/ai-builder.service";
import { SitePage } from "./site-renderer";
import { Assistant } from "./assistant";

type FieldDef = { key: string; label: string; area?: boolean };
type EditableDef = { fields: FieldDef[]; itemsKey?: string; itemFields?: FieldDef[] };

const EDITABLE: Record<Section["type"], EditableDef> = {
  hero: {
    fields: [
      { key: "headline", label: "Título" },
      { key: "subheadline", label: "Subtítulo" },
    ],
  },
  about: {
    fields: [{ key: "heading", label: "Título" }, { key: "body", label: "Texto", area: true }],
    itemsKey: "bullets",
  },
  features: {
    fields: [{ key: "heading", label: "Título" }, { key: "intro", label: "Introdução", area: true }],
    itemsKey: "items",
    itemFields: [
      { key: "title", label: "Título" },
      { key: "text", label: "Texto", area: true },
    ],
  },
  services: {
    fields: [{ key: "heading", label: "Título" }, { key: "intro", label: "Introdução", area: true }],
    itemsKey: "items",
    itemFields: [
      { key: "name", label: "Nome" },
      { key: "description", label: "Descrição", area: true },
    ],
  },
  gallery: {
    fields: [{ key: "heading", label: "Título" }],
    itemsKey: "items",
    itemFields: [{ key: "label", label: "Rótulo" }, { key: "caption", label: "Legenda" }],
  },
  stats: {
    fields: [{ key: "heading", label: "Título" }],
    itemsKey: "items",
    itemFields: [{ key: "value", label: "Valor" }, { key: "label", label: "Rótulo" }],
  },
  testimonials: {
    fields: [{ key: "heading", label: "Título" }],
    itemsKey: "items",
    itemFields: [
      { key: "quote", label: "Citação", area: true },
      { key: "author", label: "Autor" },
      { key: "role", label: "Cargo" },
    ],
  },
  faq: {
    fields: [{ key: "heading", label: "Título" }],
    itemsKey: "items",
    itemFields: [{ key: "q", label: "Pergunta" }, { key: "a", label: "Resposta", area: true }],
  },
  cta: {
    fields: [
      { key: "headline", label: "Título" },
      { key: "sub", label: "Subtítulo", area: true },
    ],
  },
  contact: {
    fields: [
      { key: "heading", label: "Título" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Telemóvel" },
      { key: "address", label: "Morada" },
      { key: "note", label: "Nota", area: true },
    ],
  },
  footer: {
    fields: [{ key: "text", label: "Texto", area: true }],
    itemsKey: "links",
    itemFields: [
      { key: "label", label: "Rótulo" },
      { key: "href", label: "Link" },
    ],
  },
  text: {
    fields: [{ key: "heading", label: "Título" }, { key: "body", label: "Texto", area: true }],
  },
};

const SECTION_LABEL: Record<Section["type"], string> = {
  hero: "Destaque",
  about: "Sobre",
  features: "Funcionalidades",
  services: "Serviços",
  gallery: "Galeria",
  stats: "Números",
  testimonials: "Testemunhos",
  faq: "Perguntas",
  cta: "Chamada à ação",
  contact: "Contacto",
  footer: "Rodapé",
  text: "Texto",
};

const DEVICES = [
  { id: "desktop", label: "🖥️", title: "Computador" },
  { id: "tablet", label: "📱", title: "Tablet", width: 768 },
  { id: "mobile", label: "📳", title: "Telemóvel", width: 390 },
] as const;

const ZOOMS = [0.75, 1, 1.25];

type FieldInput = { value: string; onChange: (v: string) => void; area?: boolean };

function Input({ value, onChange, area, placeholder }: FieldInput & { placeholder?: string }) {
  const className = "w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-brand";
  if (area) {
    return (
      <textarea className={`${className} min-h-24`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    );
  }
  return <input className={className} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={400} />;
}

export function BuilderEditor({ initialSite }: { initialSite: BuilderSite }) {
  const [site, setSite] = useState(initialSite);
  const [pages, setPages] = useState<BuilderPage[]>(initialSite.pages ?? []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [leftTab, setLeftTab] = useState<"sections" | "pages" | "theme">("sections");
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<Record<string, string>>({});
  const [rewriteInput, setRewriteInput] = useState<Record<string, string>>({});

  // History buffer for Undo/Redo
  const [history, setHistory] = useState<ParsedSection[][]>([]);
  const [redoStack, setRedoStack] = useState<ParsedSection[][]>([]);

  const page = pages[activeIndex] ?? pages[0];

  function commitSections(next: ParsedSection[], pushHistory = true): boolean {
    const parsed = parseSectionsInput(next);
    if (!parsed.ok) {
      setError(parsed.error);
      return false;
    }
    setError(null);
    if (pushHistory && page) {
      setHistory((prev) => [...prev.slice(-20), page.sections]);
      setRedoStack([]);
    }
    setPages((pages) => pages.map((p) => (p.id === page.id ? { ...p, sections: parsed.sections } : p)));
    setNotice("Alterações por guardar.");
    return true;
  }

  function handleUndo() {
    if (history.length === 0 || !page) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [...prev, page.sections]);
    setHistory((prev) => prev.slice(0, -1));
    setPages((pages) => pages.map((p) => (p.id === page.id ? { ...p, sections: previous } : p)));
    setNotice("Desfeito.");
  }

  function handleRedo() {
    if (redoStack.length === 0 || !page) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, page.sections]);
    setRedoStack((prev) => prev.slice(0, -1));
    setPages((pages) => pages.map((p) => (p.id === page.id ? { ...p, sections: next } : p)));
    setNotice("Refeito.");
  }

  function duplicateSection(sectionIndex: number) {
    if (!page) return;
    const target = page.sections[sectionIndex];
    if (!target) return;
    const clone: ParsedSection = { ...target, id: `sec-${Date.now()}` };
    const next = [...page.sections];
    next.splice(sectionIndex + 1, 0, clone);
    commitSections(next);
    setNotice("Secção duplicada.");
  }

  function addSectionPreset(type: Section["type"]) {
    if (!page) return;
    const id = `sec-${Date.now()}`;
    let newSection: ParsedSection;
    switch (type) {
      case "hero":
        newSection = { type: "hero", id, headline: "Novo Destaque", subheadline: "Insira o seu slogan", cta: { label: "Saber Mais", href: "#" } };
        break;
      case "about":
        newSection = { type: "about", id, heading: "Sobre Nós", body: "Descreva a história do seu negócio." };
        break;
      case "features":
        newSection = { type: "features", id, heading: "Vantagens", items: [{ title: "Diferencial 1", text: "Descrição." }] };
        break;
      case "services":
        newSection = { type: "services", id, heading: "Nossos Serviços", items: [{ name: "Serviço 1", description: "Descrição." }] };
        break;
      case "testimonials":
        newSection = { type: "testimonials", id, heading: "Depoimentos", items: [{ quote: "Excelente serviço!", author: "Cliente Satisfeito" }] };
        break;
      case "faq":
        newSection = { type: "faq", id, heading: "Perguntas Frequentes", items: [{ q: "Como funciona?", a: "Explicação clara." }] };
        break;
      case "contact":
        newSection = { type: "contact", id, heading: "Contactos", email: "contacto@exemplo.co.mz", phone: "+258 84 000 0000" };
        break;
      case "cta":
        newSection = { type: "cta", id, headline: "Pronto para Começar?", button: { label: "Falar Connosco", href: "#contacto" } };
        break;
      default:
        newSection = { type: "text", id, heading: "Título", body: "Escreva aqui o seu texto." };
    }
    commitSections([...page.sections, newSection]);
    setFocusedId(id);
    setNotice("Nova secção adicionada.");
  }

  function selectPage(index: number) {
    setActiveIndex(index);
    setFocusedId(null);
    setNotice(null);
    setError(null);
  }

  function selectSection(id: string | null) {
    setFocusedId(id);
    setError(null);
  }

  function setField(sectionIndex: number, key: string, value: string) {
    const next = page.sections.map((s, i) => (i === sectionIndex ? ({ ...s, [key]: value } as ParsedSection) : s));
    commitSections(next);
  }

  function setItem(sectionIndex: number, itemIndex: number, fieldOrNull: string | null, value: string) {
    const section = page.sections[sectionIndex] as ParsedSection & Record<string, unknown>;
    const def = EDITABLE[section.type];
    if (!def.itemsKey) return;
    const itemsRaw = Array.isArray(section[def.itemsKey]) ? (section[def.itemsKey] as unknown[]) : [];
    const items = itemsRaw.map((item, index) => {
      if (index !== itemIndex) return item;
      if (fieldOrNull === null) return value;
      const obj = typeof item === "object" && item !== null && !Array.isArray(item) ? { ...(item as Record<string, unknown>) } : {};
      obj[fieldOrNull] = value;
      return obj;
    });
    const next = page.sections.map((s, i) => i === sectionIndex ? ({ ...s, [def.itemsKey!]: items } as ParsedSection) : s);
    commitSections(next);
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    const section = page.sections[sectionIndex] as ParsedSection & Record<string, unknown>;
    const def = EDITABLE[section.type];
    if (!def.itemsKey) return;
    const items = ((section[def.itemsKey] as unknown[]) ?? []).filter((_, index) => index !== itemIndex);
    const next = page.sections.map((s, i) => i === sectionIndex ? ({ ...s, [def.itemsKey!]: items } as ParsedSection) : s);
    commitSections(next);
  }

  function addItem(sectionIndex: number) {
    const section = page.sections[sectionIndex] as ParsedSection & Record<string, unknown>;
    const def = EDITABLE[section.type];
    if (!def.itemsKey) return;
    const base = def.itemFields?.length ? Object.fromEntries(def.itemFields.map((f) => [f.key, ""])) : "";
    const items = [...((section[def.itemsKey] as unknown[]) ?? []), base];
    const next = page.sections.map((s, i) => i === sectionIndex ? ({ ...s, [def.itemsKey!]: items } as ParsedSection) : s);
    commitSections(next);
  }

  function moveSection(sectionIndex: number, delta: -1 | 1) {
    const target = sectionIndex + delta;
    if (target < 0 || target >= page.sections.length) return;
    const next = [...page.sections];
    [next[sectionIndex], next[target]] = [next[target], next[sectionIndex]];
    commitSections(next);
  }

  function deleteSection(sectionIndex: number) {
    if (page.sections.length <= 1) {
      setError("A página não pode ficar sem secções.");
      return;
    }
    const section = page.sections[sectionIndex];
    commitSections(page.sections.filter((_, i) => i !== sectionIndex));
    if (focusedId && focusedId === section.id) setFocusedId(null);
  }

  async function save() {
    if (!page) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/ai-builder/sites/${site.id}/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: page.sections }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao guardar.");
        return;
      }
      setNotice("Secções guardadas.");
    } catch {
      setError("Erro de ligação ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function patchSite(patch: Record<string, string>) {
    try {
      const res = await fetch(`/api/ai-builder/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao atualizar o tema.");
        return false;
      }
      setSite((s) => ({ ...s, theme: data.site.theme }));
      setNotice("Tema atualizado.");
      return true;
    } catch {
      setError("Erro de ligação ao atualizar o tema.");
      return false;
    }
  }

  async function regenerate(sectionIndex: number) {
    const section = page.sections[sectionIndex];
    const instruction = (rewriteInput[section.id] ?? "").trim();
    if (!instruction) {
      setError("Escreva a instrução para a IA reescrever esta secção.");
      return;
    }
    setError(null);
    setNotice(null);
    setRegenerating((r) => ({ ...r, [section.id]: "A reescrever…" }));
    try {
      const res = await fetch(`/api/ai-builder/sites/${site.id}/pages/${page.id}/sections/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: sectionIndex, instruction }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao reescrever.");
        return;
      }
      const next = page.sections.map((s, i) => (i === sectionIndex ? data.section : s));
      commitSections(next);
      setRewriteInput((r) => ({ ...r, [section.id]: "" }));
      setNotice("Secção reescrita pela IA.");
    } catch {
      setError("Erro de ligação ao reescrever.");
    } finally {
      setRegenerating((r) => {
        const copy = { ...r };
        delete copy[section.id];
        return copy;
      });
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/ai-builder/sites/${site.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao publicar.");
        return;
      }
      setSite((s) => ({ ...s, status: data.site.status, publishedAt: data.site.publishedAt }));
      setPublishOpen(true);
    } catch {
      setError("Erro de ligação ao publicar.");
    } finally {
      setPublishing(false);
    }
  }

  function itemValue(section: ParsedSection, item: unknown, fieldKey: string | null): string {
    if (fieldKey === null) return typeof item === "string" ? item : "";
    const obj = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    return typeof obj[fieldKey] === "string" ? (obj[fieldKey] as string) : "";
  }

  function handleAddFromAssistant(section: ParsedSection) {
    if (!page) return;
    commitSections([...page.sections, section]);
    setFocusedId(section.id);
  }

  function handleRewriteFromAssistant(index: number, section: ParsedSection) {
    if (!page) return;
    commitSections(page.sections.map((s, i) => (i === index ? section : s)));
  }

  function handleThemeFromAssistant(patch: Record<string, unknown>) {
    setSite((s) => ({ ...s, theme: { ...s.theme, ...patch } }));
    const body: Record<string, string> = {};
    if (typeof patch.primaryColor === "string") body.primaryColor = patch.primaryColor;
    if (typeof patch.accentColor === "string") body.accentColor = patch.accentColor;
    if (typeof patch.font === "string") body.typography = patch.font;
    if (Object.keys(body).length) void patchSite(body);
  }

  const focusedIndex = focusedId ? page?.sections.findIndex((s) => s.id === focusedId) ?? -1 : -1;
  const focusedSection = focusedIndex >= 0 ? page?.sections[focusedIndex] : undefined;
  const publicUrl = `/s/${site.id}`;

  return (
    <div className="ai-font space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link className="ai-btn ai-btn-ghost !px-3 !py-2 text-xs" href="/dashboard/ai-builder">
            ← Voltar
          </Link>
          <div>
            <h1 className="ai-display text-xl md:text-2xl">{site.businessName}</h1>
            <p className="mt-1 flex items-center gap-2 text-xs text-[var(--ai-muted)]">
              <span className={`ai-status-dot ${site.status === "published" ? "published" : "ready"}`} />
              {site.status === "published" ? "Publicado" : site.status === "ready" ? "Pronto a publicar" : site.status}
              {site.publishedAt ? ` · publicado a ${new Date(site.publishedAt).toLocaleDateString("pt-MZ")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Undo / Redo Buttons */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--ai-border)] p-1">
            <button
              type="button"
              className="rounded px-2.5 py-1 text-xs font-bold text-[var(--ai-ink)] hover:bg-[var(--ai-surface-2)] disabled:opacity-30"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Desfazer (Ctrl+Z)"
            >
              ↩ Desfazer
            </button>
            <button
              type="button"
              className="rounded px-2.5 py-1 text-xs font-bold text-[var(--ai-ink)] hover:bg-[var(--ai-surface-2)] disabled:opacity-30"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Refazer (Ctrl+Y)"
            >
              ↪ Refazer
            </button>
          </div>

          <button
            className="ai-btn ai-btn-ghost !px-4 !py-2 text-xs"
            type="button"
            onClick={() => setView((v) => (v === "edit" ? "preview" : "edit"))}
          >
            {view === "edit" ? "Ver pré-visualização" : "Voltar ao editor"}
          </button>
          {view === "edit" ? (
            <button className="ai-btn !px-4 !py-2 text-xs" type="button" onClick={save} disabled={saving || !page}>
              {saving ? "A guardar…" : "Guardar"}
            </button>
          ) : null}
          {site.status === "ready" ? (
            <button className="ai-btn ai-gradient-anim !px-4 !py-2 text-xs" type="button" onClick={publish} disabled={publishing}>
              {publishing ? "A publicar…" : "🚀 Publicar"}
            </button>
          ) : site.status === "published" ? (
            <a className="ai-btn ai-btn-ghost !px-4 !py-2 text-xs" href={publicUrl} target="_blank" rel="noreferrer">
              Ver online ↗
            </a>
          ) : null}
        </div>
      </div>

      {error ? <p className="rounded-lg border border-[#5c2c36] bg-[#2a1f1f] px-4 py-3 text-sm text-[#f26d6d]">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-[#2c4a32] bg-[#1f2a20] px-4 py-3 text-sm text-[#7fd88f]">{notice}</p> : null}

      {/* Domain Upsell Banner — shown when published */}
      {site.status === "published" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ai-brand-soft)]/40 bg-[var(--ai-surface-2)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg">🌐</span>
            <div>
              <p className="text-xs font-bold text-[var(--ai-ink)]">Quer um endereço profissional?</p>
              <p className="text-[11px] text-[var(--ai-muted)]">
                O seu site está em <code className="text-[var(--ai-ink)]">{publicUrl}</code> — registe um domínio
                {" "}<b className="text-[var(--ai-ink)]">.co.mz</b> ou <b className="text-[var(--ai-ink)]">.com</b> a partir de 900 MT/ano.
              </p>
            </div>
          </div>
          <a
            className="ai-btn !py-1.5 !px-3 text-xs whitespace-nowrap"
            href={`/domains/search?query=${encodeURIComponent(site.businessName.toLowerCase().replace(/[^a-z0-9]/g, ""))}.co.mz`}
            target="_blank"
            rel="noreferrer"
          >
            Registar Domínio ↗
          </a>
        </div>
      )}

      {view === "preview" ? (
        <div className="ai-card overflow-hidden">
          {page ? (
            <SitePage
              site={{ id: site.id, businessName: site.businessName, tagline: site.tagline, theme: site.theme }}
              pages={pages}
              page={page}
            />
          ) : null}
        </div>
      ) : (
        <>
          {!page ? (
            <div className="ai-card ai-card-pad text-sm text-[var(--ai-muted)]">Sem páginas geradas.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
              {/* ---- LEFT: Pages / Sections / Theme ---- */}
              <aside className="ai-card flex flex-col overflow-hidden">
                <div className="flex border-b border-[var(--ai-border)]">
                  {(["sections", "pages", "theme"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        leftTab === tab ? "ai-gradient-bg text-white" : "text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"
                      }`}
                      onClick={() => setLeftTab(tab)}
                    >
                      {tab === "sections" ? "Secções" : tab === "pages" ? "Páginas" : "Tema"}
                    </button>
                  ))}
                </div>

                <div className="max-h-[70vh] flex-1 space-y-2 overflow-y-auto p-3">
                  {leftTab === "pages" &&
                    pages.map((p, index) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          index === activeIndex
                            ? "ai-gradient-bg text-white"
                            : "text-[var(--ai-ink)] hover:bg-[var(--ai-surface-2)]"
                        }`}
                        onClick={() => selectPage(index)}
                      >
                        {p.navLabel ?? p.title}
                      </button>
                    ))}

                  {leftTab === "theme" && (
                    <div className="space-y-4 text-xs">
                      <div>
                        <span className="mb-1 block font-bold text-[var(--ai-ink)]">Cor Principal</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            className="h-8 w-10 cursor-pointer rounded border border-[var(--ai-border)] bg-transparent"
                            value={site.theme.primaryColor || "#E31E24"}
                            onChange={(e) => void patchSite({ primaryColor: e.target.value })}
                          />
                          <input
                            className="ai-input !py-1 text-xs font-mono"
                            value={site.theme.primaryColor || "#E31E24"}
                            onChange={(e) => void patchSite({ primaryColor: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <span className="mb-1 block font-bold text-[var(--ai-ink)]">Tipografia</span>
                        <div className="grid grid-cols-3 gap-1">
                          {(["sans", "display", "mono"] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              className={`rounded px-2 py-1 text-xs font-bold capitalize ${
                                (site.theme.font ?? "sans") === f
                                  ? "ai-gradient-bg text-white"
                                  : "border border-[var(--ai-border)] text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"
                              }`}
                              onClick={() => void patchSite({ typography: f })}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="mb-1 block font-bold text-[var(--ai-ink)]">Modo Visual</span>
                        <div className="grid grid-cols-2 gap-1">
                          {(["light", "dark"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={`rounded px-2 py-1 text-xs font-bold capitalize ${
                                (site.theme.mode ?? "light") === m
                                  ? "ai-gradient-bg text-white"
                                  : "border border-[var(--ai-border)] text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"
                              }`}
                              onClick={() => void patchSite({ mode: m })}
                            >
                              {m === "light" ? "☀️ Claro" : "🌙 Escuro"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {leftTab === "sections" && (
                    <>
                      {page.sections.map((section, index) => (
                        <div
                          key={section.id}
                          className={`group w-full rounded-lg border px-2.5 py-2 transition-colors cursor-pointer ${
                            focusedId === section.id
                              ? "border-[var(--ai-brand-soft)] bg-[var(--ai-surface-2)]"
                              : "border-transparent hover:border-[var(--ai-border)]"
                          }`}
                          onClick={() => selectSection(focusedId === section.id ? null : section.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              <span className="mr-1.5 text-[10px] text-[var(--ai-muted)]">{index + 1}</span>
                              {SECTION_LABEL[section.type]}
                            </span>
                            <span className="flex gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                className="px-1 text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"
                                title="Duplicar secção"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateSection(index);
                                }}
                              >
                                📋
                              </button>
                              <button
                                type="button"
                                className="px-1 text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"
                                title="Subir"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveSection(index, -1);
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="px-1 text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"
                                title="Descer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveSection(index, 1);
                                }}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="px-1 text-[#f26d6d] hover:text-[#ff8f8f]"
                                title="Eliminar"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSection(index);
                                }}
                              >
                                ✕
                              </button>
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Add Preset Section Quick Buttons */}
                      <div className="pt-3 mt-2 border-t border-[var(--ai-border)]">
                        <p className="text-[10px] font-bold text-[var(--ai-muted)] mb-1.5 uppercase tracking-wider">Adicionar Secção</p>
                        <div className="grid grid-cols-2 gap-1">
                          {(["hero", "services", "features", "about", "testimonials", "faq", "contact", "cta"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="rounded border border-[var(--ai-border)] px-2 py-1 text-[11px] text-[var(--ai-ink)] hover:bg-[var(--ai-surface-2)] text-left truncate"
                              onClick={() => addSectionPreset(t)}
                            >
                              + {SECTION_LABEL[t]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </aside>

              {/* ---- CENTER: canvas with device frame + zoom ---- */}
              <section className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-full border border-[var(--ai-border)] p-1">
                    {DEVICES.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`rounded-full px-2.5 py-1 text-sm ${device === d.id ? "ai-gradient-bg text-white" : "text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"}`}
                        title={d.title}
                        onClick={() => setDevice(d.id)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-[var(--ai-border)] p-1">
                    {ZOOMS.map((z) => (
                      <button
                        key={z}
                        type="button"
                        className={`rounded-full px-2 text-xs font-bold ${zoom === z ? "ai-gradient-bg text-white" : "text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"}`}
                        title={`${Math.round(z * 100)}%`}
                        onClick={() => setZoom(z)}
                      >
                        {Math.round(z * 100)}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ai-card overflow-auto bg-[#0b0c0a] p-4 flex justify-center">
                  <div
                    className={`transition-all duration-300 ${
                      device === "mobile"
                        ? "rounded-[36px] border-[10px] border-zinc-800 shadow-2xl overflow-hidden"
                        : device === "tablet"
                        ? "rounded-[24px] border-[12px] border-zinc-800 shadow-2xl overflow-hidden"
                        : "rounded-lg shadow-2xl overflow-hidden"
                    }`}
                    style={{
                      width: (device === "desktop" ? 1280 : device === "tablet" ? DEVICES[1].width : DEVICES[2].width) * zoom,
                    }}
                  >
                    <div
                      style={{
                        width: device === "desktop" ? 1280 : device === "tablet" ? DEVICES[1].width : DEVICES[2].width,
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                        pointerEvents: "none",
                      }}
                    >
                      <SitePage
                        site={{ id: site.id, businessName: site.businessName, tagline: site.tagline, theme: site.theme }}
                        pages={pages}
                        page={page}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-center text-[11px] text-[var(--ai-muted)]">
                  Pré-visualização em direto · clique numa secção à esquerda para editar as propriedades
                </p>
              </section>

              {/* ---- RIGHT: Properties ---- */}
              <aside className="ai-card max-h-[80vh] space-y-5 overflow-y-auto p-4">
                <div>
                  <span className="ai-label">Tema</span>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-[var(--ai-muted)]">Cor principal</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--ai-border)] bg-transparent"
                          value={/^#[0-9a-fA-F]{6}$/.test(site.theme.primaryColor ?? "") ? (site.theme.primaryColor as string) : "#E31E24"}
                          onChange={(e) => void patchSite({ primaryColor: e.target.value })}
                          aria-label="Cor principal"
                        />
                        <input
                          className="ai-input !py-1.5 font-mono text-xs"
                          value={site.theme.primaryColor ?? ""}
                          onChange={(e) => void patchSite({ primaryColor: e.target.value })}
                          placeholder="#E31E24"
                          maxLength={9}
                        />
                      </div>
                    </label>
                    <div>
                      <span className="mb-1 block text-xs text-[var(--ai-muted)]">Tipografia</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(["sans", "display", "mono"] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={`rounded-lg border px-2 py-1.5 text-xs font-bold capitalize ${
                              (site.theme.font ?? "sans") === f
                                ? "ai-gradient-bg border-transparent text-white"
                                : "border-[var(--ai-border)] text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"
                            }`}
                            onClick={() => void patchSite({ typography: f })}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--ai-border)] bg-[var(--ai-surface-2)] px-3 py-2 text-xs text-[var(--ai-muted)]">
                      Também pode pedir ao 🤖 assistente: “usa o vermelho #E31E24 como cor principal”.
                    </div>
                  </div>
                </div>

                {focusedSection ? (
                  <div className="space-y-4 border-t border-[var(--ai-border)] pt-4">
                    <div className="flex items-center justify-between">
                      <span className="ai-label !mb-0">
                        {SECTION_LABEL[focusedSection.type]}
                      </span>
                      <span className="flex gap-1 text-xs">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-[var(--ai-muted)] hover:bg-[var(--ai-surface-2)]"
                          title="Fechar"
                          onClick={() => setFocusedId(null)}
                        >
                          ✕
                        </button>
                      </span>
                    </div>

                    <div className="space-y-3">
                      {EDITABLE[focusedSection.type].fields.map((field) => (
                        <label className="profile-field" key={field.key}>
                          {field.label}
                          <Input
                            value={String((focusedSection as unknown as Record<string, unknown>)[field.key] ?? "")}
                            onChange={(v) => setField(focusedIndex, field.key, v)}
                            area={field.area}
                          />
                        </label>
                      ))}

                      {EDITABLE[focusedSection.type].itemsKey ? (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ai-muted)]">Items</p>
                          {(Array.isArray((focusedSection as unknown as Record<string, unknown>)[EDITABLE[focusedSection.type].itemsKey!])
                            ? ((focusedSection as unknown as Record<string, unknown>)[EDITABLE[focusedSection.type].itemsKey!] as unknown[])
                            : []
                          ).map((item, itemIndex) => (
                            <div className="rounded-lg border border-[var(--ai-border)] p-2.5" key={itemIndex}>
                              <div className="space-y-2">
                                {EDITABLE[focusedSection.type].itemFields?.length
                                  ? EDITABLE[focusedSection.type].itemFields!.map((f) => (
                                      <label className="profile-field" key={f.key}>
                                        {f.label}
                                        <Input
                                          value={itemValue(focusedSection, item, f.key)}
                                          onChange={(v) => setItem(focusedIndex, itemIndex, f.key, v)}
                                          area={f.area}
                                        />
                                      </label>
                                    ))
                                  : (
                                      <Input
                                        value={itemValue(focusedSection, item, null)}
                                        onChange={(v) => setItem(focusedIndex, itemIndex, null, v)}
                                      />
                                    )}
                              </div>
                              <button
                                className="mt-1.5 text-xs text-[#f26d6d]"
                                type="button"
                                onClick={() => removeItem(focusedIndex, itemIndex)}
                              >
                                Remover item
                              </button>
                            </div>
                          ))}
                          <button
                            className="text-xs font-bold text-[var(--ai-brand-soft)]"
                            type="button"
                            onClick={() => addItem(focusedIndex)}
                          >
                            + Adicionar item
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2 rounded-lg border border-[var(--ai-border)] bg-[var(--ai-surface-2)] p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--ai-muted)]">Reescrever com IA</p>
                      <input
                        className="ai-input !py-2 text-sm"
                        value={rewriteInput[focusedSection.id] ?? ""}
                        onChange={(e) => setRewriteInput((r) => ({ ...r, [focusedSection.id]: e.target.value }))}
                        placeholder="Ex.: torna o tom mais direto para jovens"
                        maxLength={500}
                      />
                      <button
                        className="ai-btn !py-2 text-xs"
                        type="button"
                        onClick={() => regenerate(focusedIndex)}
                        disabled={Boolean(regenerating[focusedSection.id])}
                      >
                        {regenerating[focusedSection.id] ?? "✨ Reescrever"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--ai-border)] p-4 text-center text-xs text-[var(--ai-muted)]">
                    Selecione uma secção na lista à esquerda para editar o conteúdo.
                  </div>
                )}
              </aside>
            </div>
          )}

          <Assistant
            siteId={site.id}
            pageId={page?.id}
            onAddSection={handleAddFromAssistant}
            onRewriteSection={handleRewriteFromAssistant}
            onSetTheme={handleThemeFromAssistant}
          />
        </>
      )}

      {publishOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="ai-card ai-card-pad w-full max-w-lg text-center space-y-4">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#3fbf5a]/20 text-3xl">🎉</span>
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-[#3fbf5a]/20 px-3 py-1 text-xs font-bold text-[#3fbf5a]">
                ⚡ Publicado Grátis (Plano 0 MT)
              </span>
              <h2 className="ai-display text-2xl">O seu website está online!</h2>
              <p className="text-sm text-[var(--ai-muted)]">
                O site de <b className="text-[var(--ai-ink)]">{site.businessName}</b> já está acessível gratuitamente ao público.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--ai-border)] bg-[var(--ai-surface-2)] p-4 text-left space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--ai-muted)]">Endereço Grátis Ativo</span>
              <div className="flex items-center justify-between gap-2">
                <code className="truncate font-mono text-sm font-semibold text-[var(--ai-ink)]">{publicUrl}</code>
                <a className="ai-btn !py-1.5 !px-3 text-xs" href={publicUrl} target="_blank" rel="noreferrer">
                  Abrir ↗
                </a>
              </div>
            </div>

            {/* High Converting Custom Domain Upsell */}
            <div className="rounded-2xl border border-[var(--ai-brand-soft)]/50 bg-gradient-to-b from-[var(--ai-surface-2)] to-black/40 p-5 text-left space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌐</span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ai-ink)]">Adicione o seu Domínio Personalizado (.co.mz)</h3>
                  <p className="text-xs text-[var(--ai-muted)]">Transmita 100% de confiança aos seus clientes com um endereço próprio.</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  className="ai-input flex-1 !py-2 text-sm"
                  placeholder="Ex.: sabordobairro.co.mz"
                  defaultValue={site.domain || `${site.businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.co.mz`}
                  id="modalDomainQuery"
                />
                <button
                  type="button"
                  className="ai-btn !py-2 text-xs whitespace-nowrap"
                  onClick={() => {
                    const el = document.getElementById("modalDomainQuery") as HTMLInputElement | null;
                    const q = el?.value.trim() || site.businessName;
                    window.open(`/domains/search?query=${encodeURIComponent(q)}`, "_blank");
                  }}
                >
                  Pesquisar Domínio ↗
                </button>
              </div>
              <p className="text-[11px] text-[var(--ai-muted)]">
                Domínios <b className="text-[var(--ai-ink)]">.co.mz</b> a partir de 900 MT/ano · Configuração DNS automática!
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <a className="ai-btn ai-btn-ghost" href={publicUrl} target="_blank" rel="noreferrer">
                Ver Site Online ↗
              </a>
              <button className="ai-btn ai-btn-ghost" type="button" onClick={() => setPublishOpen(false)}>
                Continuar a Editar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}