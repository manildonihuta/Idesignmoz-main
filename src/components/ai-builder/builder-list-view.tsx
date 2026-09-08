"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { BuilderSite } from "@/services/ai-builder.service";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  generating: "A gerar…",
  ready: "Pronto",
  failed: "Falhou",
  published: "Publicado",
  archived: "Arquivado",
};

type ApiSite = BuilderSite;

type CreateForm = {
  businessName: string;
  industry: string;
  domain: string;
  tagline: string;
  brief: string;
  primaryColor: string;
};

const EMPTY_FORM: CreateForm = {
  businessName: "",
  industry: "",
  domain: "",
  tagline: "",
  brief: "",
  primaryColor: "",
};

export function BuilderListView() {
  const [sites, setSites] = useState<ApiSite[]>([]);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-builder/sites")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setSites(data.sites ?? []);
      })
      .catch(() => setError("Não foi possível carregar os sites."))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof CreateForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function generate() {
    setError(null);
    setNotice(null);
    if (!form.businessName.trim() || !form.brief.trim()) {
      setError("Indique o nome do negócio e descreva o que faz.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/ai-builder/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Erro ao gerar.");
        return;
      }
      setNotice(`Site gerado com ${data.pages} páginas.`);
      setForm(EMPTY_FORM);
      const list = await (await fetch("/api/ai-builder/sites")).json();
      if (list.ok) setSites(list.sites ?? []);
    } catch {
      setError("Erro de ligação. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">Criador de websites com IA</h1>
        <p className="text-muted">Descreva o negócio e gere o site em segundos.</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-1 text-lg font-semibold">Novo site</h2>
        <p className="mb-5 text-sm text-muted">Todos os textos são gerados em português de Moçambique.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="profile-field">
            Nome do negócio *
            <input
              className="profile-input"
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="Ex.: Padaria Sabor do Bairro"
              maxLength={160}
            />
          </label>
          <label className="profile-field">
            Sector / indústria
            <input
              className="profile-input"
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              placeholder="Ex.: Alimentação e bebidas"
              maxLength={120}
            />
          </label>
          <label className="profile-field">
            Domínio (opcional)
            <input
              className="profile-input"
              value={form.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder="Ex.: sabordobairro.co.mz"
              maxLength={200}
            />
          </label>
          <label className="profile-field">
            Slogan (opcional)
            <input
              className="profile-input"
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Ex.: Fresquinho todos os dias"
              maxLength={300}
            />
          </label>
          <label className="profile-field md:col-span-2">
            Descreva o seu negócio *
            <textarea
              className="profile-input min-h-28"
              value={form.brief}
              onChange={(e) => set("brief", e.target.value)}
              placeholder="O que faz, quem é o público, que serviços/produtos oferece, o que quer comunicar…"
              maxLength={4000}
            />
          </label>
          <label className="profile-field">
            Cor principal (opcional)
            <input
              className="profile-input"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              placeholder="Ex.: #c8ff4d"
              maxLength={9}
            />
          </label>
        </div>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-green-400">{notice}</p> : null}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button className="button" type="button" onClick={generate} disabled={generating}>
            {generating ? "A gerar com IA…" : "Gerar site com IA"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Os meus sites</h2>
        {loading && <p className="text-sm text-muted">A carregar…</p>}
        {!loading && sites.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não gerou nenhum site.
          </div>
        )}
        {sites.map((site) => (
          <Link className="website-card block hover:border-brand" href={`/dashboard/ai-builder/${site.id}`} key={site.id}>
            <div className="website-card-head">
              <div className="website-favicon">{site.businessName.charAt(0) || "S"}</div>
              <div>
                <h3>{site.businessName}</h3>
                <p className="website-url">
                  {site.domain ?? "Sem domínio"} · {new Date(site.createdAt).toLocaleDateString("pt-MZ")}
                </p>
              </div>
              <span className={`site-status ${site.status === "published" ? "live" : site.status === "generating" || site.status === "ready" ? "dev" : site.status === "failed" ? "off" : ""}`}>
                {STATUS_LABEL[site.status] ?? site.status}
              </span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}