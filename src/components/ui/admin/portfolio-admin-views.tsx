"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  MoveUp,
  MoveDown,
  Upload,
  Save,
  Loader2,
  Search,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import type { Project } from "@/lib/portfolio";

export function PortfolioAdminView({
  notify,
}: {
  notify: (type: "ok" | "error", text: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form State
  const [client, setClient] = useState("");
  const [industry, setIndustry] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [services, setServices] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [summary, setSummary] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function loadPortfolio() {
      try {
        const res = await fetch("/api/admin/portfolio");
        const data = await res.json();
        if (data.ok && Array.isArray(data.projects)) {
          setProjects(data.projects);
        } else {
          notify("error", data.error || "Erro ao carregar os trabalhos.");
        }
      } catch {
        notify("error", "Erro ao conectar com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    void loadPortfolio();
  }, [notify]);

  const openNewModal = () => {
    setEditingIndex(null);
    setClient("");
    setIndustry("Tecnologia");
    setYear(new Date().getFullYear().toString());
    setServices("Website / Branding");
    setUrl("");
    setImage("");
    setSummary("");
    setModalOpen(true);
  };

  const openEditModal = (index: number) => {
    const p = projects[index];
    if (!p) return;
    setEditingIndex(index);
    setClient(p.client || "");
    setIndustry(p.industry || "");
    setYear(p.year || new Date().getFullYear().toString());
    setServices(Array.isArray(p.services) ? p.services.join(", ") : p.services || "");
    setUrl(p.url || "");
    setImage(p.image || "");
    setSummary(p.summary || "");
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.ok && data.url) {
        setImage(data.url);
        notify("ok", "Imagem carregada com sucesso.");
      } else {
        notify("error", data.error || "Falha ao carregar a imagem.");
      }
    } catch {
      notify("error", "Erro de rede ao carregar a imagem.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.trim()) {
      notify("error", "O nome do cliente / projeto é obrigatório.");
      return;
    }

    const servicesList = services
      .split(/[,/]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const slug = client.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

    const newProject: Project = {
      slug,
      client: client.trim(),
      industry: industry.trim() || "Geral",
      year: year.trim() || new Date().getFullYear().toString(),
      categories: ["Websites"],
      services: servicesList.length > 0 ? servicesList : ["Website"],
      image: image.trim(),
      summary: summary.trim(),
      challenge: "",
      strategy: "",
      design: "",
      development: "",
      technology: ["Next.js", "React", "Tailwind CSS"],
      results: [],
      url: url.trim() || undefined,
    };

    let updated: Project[];
    if (editingIndex !== null) {
      updated = [...projects];
      updated[editingIndex] = { ...updated[editingIndex], ...newProject };
    } else {
      updated = [newProject, ...projects];
    }

    setProjects(updated);
    setModalOpen(false);
  };

  const handleDelete = (index: number) => {
    if (!confirm(`Remover o projeto "${projects[index].client}"?`)) return;
    const updated = projects.filter((_, i) => i !== index);
    setProjects(updated);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= projects.length) return;

    const updated = [...projects];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setProjects(updated);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/portfolio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects }),
      });

      const data = await res.json();
      if (data.ok) {
        notify("ok", "Trabalhos guardados e atualizados no site!");
      } else {
        notify("error", data.error || "Erro ao guardar trabalhos.");
      }
    } catch {
      notify("error", "Erro ao conectar com o servidor.");
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.industry.toLowerCase().includes(search.toLowerCase()) ||
      p.summary.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-line bg-surface">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        <span className="ml-3 text-sm text-muted">A carregar trabalhos...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Pesquisar por cliente, indústria ou resumo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-4 text-sm text-paper placeholder-muted focus:border-brand focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openNewModal}
            className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-paper border border-line transition-all hover:bg-surface-3 hover:border-brand"
          >
            <Plus className="h-4 w-4 text-brand" />
            Adicionar Trabalho
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar no Site
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((p, idx) => {
          const actualIndex = projects.indexOf(p);
          return (
            <div
              key={p.slug || idx}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand/50 shadow-sm"
            >
              <div>
                {/* Thumbnail */}
                <div className="relative mb-3 h-40 w-full overflow-hidden rounded-lg bg-surface-2">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.client}
                      className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-muted">
                      <Sparkles className="h-8 w-8 text-brand/40" />
                      <span className="mt-1 text-xs">Sem capa definida</span>
                    </div>
                  )}

                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand backdrop-blur-md">
                    {p.industry || "Projeto"} · {p.year}
                  </span>

                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white shadow-md transition-transform hover:scale-110"
                      title="Visitar site do projeto"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <h3 className="text-lg font-bold text-paper">{p.client}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted">
                  {p.summary || "Sem descrição..."}
                </p>

                {p.services && p.services.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(Array.isArray(p.services) ? p.services : [p.services]).map((s, i) => (
                      <span
                        key={i}
                        className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(actualIndex, "up")}
                    disabled={actualIndex === 0}
                    className="rounded p-1 text-muted transition-colors hover:bg-surface-2 hover:text-paper disabled:opacity-30"
                    title="Mover para cima"
                  >
                    <MoveUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(actualIndex, "down")}
                    disabled={actualIndex === projects.length - 1}
                    className="rounded p-1 text-muted transition-colors hover:bg-surface-2 hover:text-paper disabled:opacity-30"
                    title="Mover para baixo"
                  >
                    <MoveDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(actualIndex)}
                    className="flex items-center gap-1 rounded bg-surface-2 px-2.5 py-1 text-xs font-semibold text-paper transition-colors hover:bg-brand hover:text-white"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(actualIndex)}
                    className="rounded p-1 text-muted transition-colors hover:bg-red-500/20 hover:text-red-400"
                    title="Remover projeto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="col-span-full flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">
            <Briefcase className="h-10 w-10 text-muted/50 mb-2" />
            <p className="text-sm font-semibold">Nenhum trabalho encontrado.</p>
            <p className="text-xs">Clique em "Adicionar Trabalho" para cadastrar o primeiro.</p>
          </div>
        )}
      </div>

      {/* Modal Adicionar / Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <h3 className="text-lg font-bold text-paper">
                {editingIndex !== null ? "Editar Trabalho" : "Novo Trabalho"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-paper"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Cliente / Nome do Projeto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hotel Castel"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 p-2.5 text-sm text-paper focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Indústria / Sector
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Hospitality, Tecnologia, E-commerce"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 p-2.5 text-sm text-paper focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Ano de Realização
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2026"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 p-2.5 text-sm text-paper focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Link do Projeto (URL de visualização)
                  </label>
                  <input
                    type="url"
                    placeholder="https://exemplo.co.mz"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 p-2.5 text-sm text-paper focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Serviços Prestados (separados por vírgula)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Website, Branding, E-commerce, SEO"
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-2 p-2.5 text-sm text-paper focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Imagem de Capa (URL ou Upload)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/... ou /uploads/..."
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="flex-1 rounded-lg border border-line bg-surface-2 p-2.5 text-sm text-paper focus:border-brand focus:outline-none"
                  />
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-paper hover:border-brand hover:bg-surface-3">
                    {uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    ) : (
                      <Upload className="h-4 w-4 text-brand" />
                    )}
                    <span>Carregar</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
                {image && (
                  <div className="mt-2 relative h-28 w-full overflow-hidden rounded-lg border border-line bg-surface-2">
                    <img src={image} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Resumo do Trabalho
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva brevemente o projeto e os resultados alcançados..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-2 p-2.5 text-sm text-paper focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-line pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-paper hover:bg-surface-3"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand/90"
                >
                  <Check className="h-4 w-4" />
                  <span>Confirmar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
