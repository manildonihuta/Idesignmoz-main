"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { BuilderSite } from "@/services/ai-builder.service";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  generating: "A gerar…",
  ready: "Pronto a publicar",
  failed: "Falhou",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_CLASS: Record<string, string> = {
  published: "live",
  generating: "dev",
  ready: "dev",
  failed: "off",
};

export function BuilderListView() {
  const [sites, setSites] = useState<BuilderSite[]>([]);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-builder/sites")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setSites(data.sites ?? []);
          setQuota(data.quota ?? null);
        } else {
          setError(data.error ?? "Erro ao carregar os sites.");
        }
      })
      .catch(() => setError("Não foi possível carregar os sites."))
      .finally(() => setLoading(false));
  }, []);

  const canCreate = !quota || quota.used < quota.limit;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
            Website Builder com IA
          </h1>
          <p className="mt-1 text-sm text-muted">
            Descreva o negócio e a IA cria o site completo — 100% grátis.
          </p>
        </div>
        {canCreate && (
          <Link className="button button-small" href="/dashboard/ai-builder/new">
            + Criar novo site
          </Link>
        )}
      </div>

      {/* Quota + free tier banner */}
      {quota && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          style={{
            borderColor: "rgba(82,39,255,0.2)",
            background: "linear-gradient(135deg, #181210 0%, #0f0f0f 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-xs font-bold text-paper">
                Plano Grátis — {quota.used} / {quota.limit} sites utilizados
              </p>
              <p className="text-[11px] text-muted">
                {quota.used < quota.limit
                  ? `Ainda pode criar ${quota.limit - quota.used} site${quota.limit - quota.used !== 1 ? "s" : ""} grátis.`
                  : "Atingiu o limite do plano grátis. Contacte-nos para mais."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* quota bar */}
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
                  background: quota.used >= quota.limit ? "#ef4444" : "var(--lime)",
                }}
              />
            </div>
            {canCreate && (
              <Link
                className="outline-button button-small"
                href="/dashboard/ai-builder/new"
              >
                Criar site
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
          {error}
        </p>
      )}

      {/* Sites list */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Os meus sites
        </h2>

        {loading && (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="website-card animate-pulse"
                style={{ opacity: 0.4 }}
              />
            ))}
          </div>
        )}

        {!loading && sites.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="mb-1 text-lg font-semibold text-paper">Nenhum site criado ainda</p>
            <p className="mb-6 text-sm text-muted">
              Crie o seu primeiro website com IA em menos de 1 minuto — gratuitamente.
            </p>
            <Link className="button" href="/dashboard/ai-builder/new">
              ✨ Criar o meu primeiro site
            </Link>
          </div>
        )}

        {sites.map((site) => {
          const publicUrl = `/s/${site.id}`;
          return (
            <div key={site.id} className="website-card group relative">
              <div className="website-card-head">
                <div
                  className="website-favicon"
                  style={{
                    background: site.theme?.primaryColor
                      ? `${site.theme.primaryColor}22`
                      : undefined,
                    color: site.theme?.primaryColor ?? "var(--lime)",
                  }}
                >
                  {site.businessName.charAt(0).toUpperCase() || "S"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate">{site.businessName}</h3>
                  <p className="website-url truncate">
                    {site.domain
                      ? site.domain
                      : site.status === "published"
                      ? publicUrl
                      : "Sem domínio personalizado"}
                    {" · "}
                    {new Date(site.createdAt).toLocaleDateString("pt-MZ")}
                  </p>
                </div>
                <span className={`site-status ${STATUS_CLASS[site.status] ?? ""}`}>
                  {STATUS_LABEL[site.status] ?? site.status}
                </span>
              </div>

              {/* meta row */}
              <div className="website-meta">
                <div>
                  <p className="text-muted text-[10px] uppercase tracking-wide" style={{ fontFamily: "var(--font-mono)" }}>
                    Páginas
                  </p>
                  <p>{(site.pages?.length ?? 0) > 0 ? `${site.pages!.length} páginas` : "—"}</p>
                </div>
                <div>
                  <p className="text-muted text-[10px] uppercase tracking-wide" style={{ fontFamily: "var(--font-mono)" }}>
                    Domínio
                  </p>
                  <p>{site.domain ?? ".co.mz disponível"}</p>
                </div>
                <div>
                  <p className="text-muted text-[10px] uppercase tracking-wide" style={{ fontFamily: "var(--font-mono)" }}>
                    Publicado
                  </p>
                  <p>
                    {site.publishedAt
                      ? new Date(site.publishedAt).toLocaleDateString("pt-MZ")
                      : "Ainda não"}
                  </p>
                </div>
              </div>

              {/* action bar */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Link
                  className="outline-button button-small"
                  href={`/dashboard/ai-builder/${site.id}`}
                >
                  ✏️ Editar
                </Link>
                {site.status === "published" && (
                  <a
                    className="outline-button button-small"
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🔗 Ver site
                  </a>
                )}
                {!site.domain && (
                  <a
                    className="button button-small"
                    href={`/domains/search?query=${encodeURIComponent(
                      site.businessName.toLowerCase().replace(/[^a-z0-9]/g, ""),
                    )}.co.mz`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🌐 Registar domínio
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}