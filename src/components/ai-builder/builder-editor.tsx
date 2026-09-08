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
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<Record<string, string>>({});
  const [rewriteInput, setRewriteInput] = useState<Record<string, string>>({});

  const page = pages[activeIndex] ?? pages[0];

  function commitSections(next: ParsedSection[]): boolean {
    const parsed = parseSectionsInput(next);
    if (!parsed.ok) {
      setError(parsed.error);
      return false;
    }
    setError(null);
    setPages((pages) => pages.map((p) => (p.id === page.id ? { ...p, sections: parsed.sections } : p)));
    setNotice("Alterações por guardar.");
    return true;
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
    const next = page.sections.map((s, i) =>
      i === sectionIndex ? ({ ...s, [def.itemsKey!]: items } as ParsedSection) : s,
    );
    commitSections(next);
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    const section = page.sections[sectionIndex] as ParsedSection & Record<string, unknown>;
    const def = EDITABLE[section.type];
    if (!def.itemsKey) return;
    const itemsRaw = (section[def.itemsKey] as unknown[]) ?? [];
    const items = itemsRaw.filter((_, index) => index !== itemIndex);
    const next = page.sections.map((s, i) =>
      i === sectionIndex ? ({ ...s, [def.itemsKey!]: items } as ParsedSection) : s,
    );
    commitSections(next);
  }

  function addItem(sectionIndex: number) {
    const section = page.sections[sectionIndex] as ParsedSection & Record<string, unknown>;
    const def = EDITABLE[section.type];
    if (!def.itemsKey) return;
    const base = def.itemFields?.length ? Object.fromEntries(def.itemFields.map((f) => [f.key, ""])) : "";
    const items = [...((section[def.itemsKey] as unknown[]) ?? []), base];
    const next = page.sections.map((s, i) => (i === sectionIndex ? ({ ...s, [def.itemsKey!]: items } as ParsedSection) : s));
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
    commitSections(page.sections.filter((_, i) => i !== sectionIndex));
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
      const res = await fetch(
        `/api/ai-builder/sites/${site.id}/pages/${page.id}/sections/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index: sectionIndex, instruction }),
        },
      );
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
      setNotice("Site publicado. Já está online.");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display-2 text-2xl font-semibold tracking-tight">{site.businessName}</h1>
          <p className="text-muted">
            {site.tagline || "Sem slogan"} ·{" "}
            <span className={site.status === "published" ? "text-green-400" : "text-yellow-400"}>
              {site.status === "published" ? "Publicado" : site.status === "ready" ? "Pronto" : site.status}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="outline-button"
            type="button"
            onClick={() => setView((v) => (v === "edit" ? "preview" : "edit"))}
          >
            {view === "edit" ? "Ver pré-visualização" : "Voltar ao editor"}
          </button>
          <Link className="outline-button" href="/dashboard/ai-builder">
            ← Voltar
          </Link>
          {site.status === "ready" ? (
            <button className="button" type="button" onClick={publish} disabled={publishing}>
              {publishing ? "A publicar…" : "Publicar"}
            </button>
          ) : (
            <a className="outline-button" href={`/s/${site.id}`} target="_blank" rel="noreferrer">
              Ver online ↗
            </a>
          )}
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-300">{notice}</p> : null}

      {view === "preview" ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <SitePage
            site={{ id: site.id, businessName: site.businessName, tagline: site.tagline, theme: site.theme }}
            pages={pages}
            page={page}
          />
        </div>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2">
            {pages.map((p, index) => (
              <button
                key={p.id}
                type="button"
                className={`rounded-full border px-4 py-2 text-sm ${index === activeIndex ? "border-brand text-brand" : "border-line text-muted"}`}
                onClick={() => setActiveIndex(index)}
              >
                {p.navLabel ?? p.title}
              </button>
            ))}
            <button className="ml-auto text-sm text-muted" type="button" onClick={save} disabled={saving || !page}>
              {saving ? "A guardar…" : "Guardar"}
            </button>
          </nav>

          {!page ? (
            <p className="text-muted">Sem páginas geradas.</p>
          ) : (
            <div className="space-y-4">
              {page.sections.map((section, sectionIndex) => {
                const def = EDITABLE[section.type];
                const busy = regenerating[section.id];
                return (
                  <div className="rounded-xl border border-line bg-surface p-6" key={section.id}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
                        {SECTION_LABEL[section.type]}
                      </span>
                      <div className="flex gap-1.5">
                        <button className="px-3 py-1 text-muted hover:text-paper" type="button" onClick={() => moveSection(sectionIndex, -1)} title="Subir">
                          ↑
                        </button>
                        <button className="px-3 py-1 text-muted hover:text-paper" type="button" onClick={() => moveSection(sectionIndex, 1)} title="Descer">
                          ↓
                        </button>
                        <button className="px-3 py-1 text-red-400 hover:text-red-300" type="button" onClick={() => deleteSection(sectionIndex)} title="Eliminar">
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {def.fields.map((field) => (
                        <label className="profile-field" key={field.key}>
                          {field.label}
                          <Input
                            value={String((section as unknown as Record<string, unknown>)[field.key] ?? "")}
                            onChange={(v) => setField(sectionIndex, field.key, v)}
                            area={field.area}
                          />
                        </label>
                      ))}

                      {def.itemsKey ? (
                        <div className="mt-2 space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted">Items</p>
                          {(Array.isArray((section as unknown as Record<string, unknown>)[def.itemsKey])
                            ? ((section as unknown as Record<string, unknown>)[def.itemsKey] as unknown[])
                            : []
                          ).map((item, itemIndex) => (
                            <div className="rounded-lg border border-line/60 p-3" key={itemIndex}>
                              <div className="grid gap-2">
                                {def.itemFields?.length
                                  ? def.itemFields.map((f) => (
                                      <label className="profile-field" key={f.key}>
                                        {f.label}
                                        <Input
                                          value={itemValue(section, item, f.key)}
                                          onChange={(v) => setItem(sectionIndex, itemIndex, f.key, v)}
                                          area={f.area}
                                        />
                                      </label>
                                    ))
                                  : (
                                      <Input
                                        value={itemValue(section, item, null)}
                                        onChange={(v) => setItem(sectionIndex, itemIndex, null, v)}
                                      />
                                    )}
                              </div>
                              <button className="mt-2 text-xs text-red-400" type="button" onClick={() => removeItem(sectionIndex, itemIndex)}>
                                Remover item
                              </button>
                            </div>
                          ))}
                          <button className="text-sm text-brand" type="button" onClick={() => addItem(sectionIndex)}>
                            + Adicionar item
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 flex flex-col gap-2 rounded-lg border border-line/60 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">Reescrever com IA</p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="profile-input max-w-md"
                          value={rewriteInput[section.id] ?? ""}
                          onChange={(e) => setRewriteInput((r) => ({ ...r, [section.id]: e.target.value }))}
                          placeholder="Ex.: torna o tom mais direto para jovens"
                          maxLength={500}
                        />
                        <button
                          className="outline-button button-small"
                          type="button"
                          onClick={() => regenerate(sectionIndex)}
                          disabled={Boolean(busy)}
                        >
                          {busy ?? "Reescrever"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}