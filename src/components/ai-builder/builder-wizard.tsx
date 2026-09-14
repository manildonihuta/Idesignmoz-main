"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AiTemplate } from "@/lib/ai-templates";

const INDUSTRIES: { id: string; label: string }[] = [
  { id: "Restaurante e alimentação", label: "🍽️ Restaurante" },
  { id: "Hotel e alojamento", label: "🏨 Hotel" },
  { id: "Portfólio", label: "🎨 Portfólio" },
  { id: "Empresa / serviços", label: "💼 Negócio" },
  { id: "Loja online", label: "🛍️ Loja online" },
  { id: "Imobiliário", label: "🏡 Imobiliário" },
  { id: "Landing page", label: "🚀 Landing page" },
  { id: "Outro", label: "✨ Outro" },
];

const STYLES: { id: string; label: string; desc: string }[] = [
  { id: "modern", label: "⚡ Moderno", desc: "Limpo, muito espaço em branco e gradientes subtis." },
  { id: "minimal", label: "○ Minimalista", desc: "Paleta contida, elegante e sem ruído visual." },
  { id: "bold", label: "🔥 Arrojado", desc: "Cores fortes, contraste alto e expressivo." },
  { id: "elegant", label: "✦ Elegante", desc: "Premium, linhas finas e tipografia sóbria." },
  { id: "playful", label: "🎈 Divertido", desc: "Vivo, informal e acolhedor." },
];

const TYPOGRAPHY: { id: "sans" | "display" | "mono"; label: string; desc: string }[] = [
  { id: "sans", label: "Sans-serif", desc: "Limpa e moderna, ideal para qualquer negócio." },
  { id: "display", label: "Display", desc: "Grande e cheia de personalidade." },
  { id: "mono", label: "Mono", desc: "Técnica e criativa, com tom geek." },
];

const COLORS: { id: "auto" | "brand" | "custom"; label: string; desc: string }[] = [
  { id: "auto", label: "Automático", desc: "A IA escolhe a paleta ideal." },
  { id: "brand", label: "Marca IDesign", desc: "Usa o vermelho IDesign como cor principal." },
  { id: "custom", label: "Personalizada", desc: "Defina a cor principal (código hexadecimal)." },
];

const GEN_STEPS = [
  "A ler a sua descrição…",
  "A desenhar a estrutura e as páginas…",
  "A escrever os textos em português de Moçambique…",
  "A escolher o estilo, cores e tipografia…",
];

const STEP_LABELS = ["Ideia", "Estilo", "Gerar"];

type Form = {
  businessName: string;
  industry: string;
  domain: string;
  tagline: string;
  brief: string;
  style: string;
  color: "auto" | "brand" | "custom";
  customColor: string;
  typography: "sans" | "display" | "mono";
};

function defaultForm(initialBrief: string, template?: AiTemplate | null): Form {
  return {
    businessName: "",
    industry: template?.industry ?? "",
    domain: "",
    tagline: "",
    brief: initialBrief || template?.brief || "",
    style: template?.style ?? "modern",
    color: "auto",
    customColor: "#E31E24",
    typography: "sans",
  };
}

export function BuilderWizard({
  initialBrief,
  initialTemplate,
}: {
  initialBrief: string;
  initialTemplate?: AiTemplate | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(() => defaultForm(initialBrief, initialTemplate ?? null));
  const [templateName, setTemplateName] = useState<string>(initialTemplate?.name ?? "");
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!form.businessName.trim()) {
        setError("Indique o nome do seu negócio.");
        return;
      }
      if (form.brief.trim().length < 20) {
        setError("Descreva o seu negócio em pelo menos 20 caracteres.");
        return;
      }
    }
    setStep((s) => s + 1);
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function generate() {
    setError(null);
    if (step !== 2) next();
    setStep(2);
    setPhase(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setPhase((p) => Math.min(GEN_STEPS.length - 1, p + 1));
    }, 1500);

    try {
      const res = await fetch("/api/ai-builder/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: initialTemplate?.id,
          businessName: form.businessName,
          industry: form.industry || undefined,
          domain: form.domain.trim() || undefined,
          tagline: form.tagline.trim() || undefined,
          brief: form.brief,
          style: form.style || undefined,
          colorPreference: form.color,
          primaryColor:
            form.color === "custom" && /^#[0-9a-fA-F]{3,8}$/.test(form.customColor) ? form.customColor : undefined,
          typography: form.typography,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (timerRef.current) clearInterval(timerRef.current);
        setError(data.error ?? "Erro ao gerar o site.");
        return;
      }
      router.push(`/dashboard/ai-builder/${data.siteId}`);
    } catch {
      if (timerRef.current) clearInterval(timerRef.current);
      setError("Erro de ligação. Tente novamente.");
    }
  }

  return (
    <div className="ai-font space-y-8">
      <nav className="breadcrumbs" aria-label="Navegação">
        <Link href="/dashboard">Início</Link>
        <span>/</span>
        <Link href="/dashboard/ai-builder">Criar com IA</Link>
        <span>/</span>
        Novo website
      </nav>

      <div>
        <span className="ai-section-kicker">
          <span className="ai-dot" />
          IDesign AI Builder
        </span>
        <h1 className="ai-display mt-4 text-2xl">
          Criar um novo <span className="ai-gradient-text">website</span>
        </h1>
      </div>

      <ol className="flex flex-wrap items-center gap-3">
        {STEP_LABELS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li
              key={label}
              className={`ai-badge ${state === "active" ? "ai-badge-grad" : ""}`}
              style={{ opacity: state === "todo" ? 0.55 : 1 }}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span>{state === "done" ? "✓" : i + 1}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <section className="ai-card ai-card-pad space-y-8">
          {templateName ? (
            <div className="ai-card ai-card-pad flex flex-wrap items-center justify-between gap-3 !py-4">
              <span className="text-sm">
                <span className="ai-gradient-text font-bold">Modelo selecionado:</span>{" "}
                {templateName}
              </span>
              <button
                type="button"
                className="ai-btn ai-btn-ghost !px-3 !py-1.5 text-xs"
                onClick={() => {
                  setTemplateName("");
                  set("industry", "");
                  set("style", "modern");
                }}
              >
                Trocar modelo
              </button>
            </div>
          ) : null}

          <div>
            <span className="ai-section-kicker">
              <span className="ai-dot" />
              O seu negócio
            </span>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind.id}
                  type="button"
                  className={`ai-chip ${form.industry === ind.id ? "!border-[var(--ai-brand-soft)] !text-[var(--ai-ink)]" : ""}`}
                  onClick={() => set("industry", ind.id)}
                >
                  {ind.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="ai-label">Nome do negócio *</span>
              <input
                className="ai-input"
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                placeholder="Ex.: Padaria Sabor do Bairro"
                maxLength={160}
              />
            </label>
            <label className="block">
              <span className="ai-label">Domínio (opcional)</span>
              <input
                className="ai-input"
                value={form.domain}
                onChange={(e) => set("domain", e.target.value)}
                placeholder="Ex.: sabordobairro.co.mz"
                maxLength={200}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="ai-label">Slogan (opcional)</span>
              <input
                className="ai-input"
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="Ex.: Fresquinho todos os dias"
                maxLength={300}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="ai-label">Descreva o seu negócio * (mín. 20 caracteres)</span>
              <textarea
                className="ai-input min-h-32"
                value={form.brief}
                onChange={(e) => set("brief", e.target.value)}
                placeholder="O que faz, quem é o público, que serviços/produtos oferece, o que quer comunicar…"
                maxLength={4000}
              />
            </label>
          </div>

          {error ? <p className="text-sm font-semibold text-[#f26d6d]">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link className="ai-btn ai-btn-ghost" href="/dashboard/ai-builder">
              Cancelar
            </Link>
            <button type="button" className="ai-btn" onClick={next}>
              Continuar para o estilo →
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="ai-card ai-card-pad space-y-8">
          <div>
            <span className="ai-section-kicker">
              <span className="ai-dot" />
              Estilo
            </span>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`ai-card ai-card-pad text-left transition-colors ${form.style === s.id ? "ai-gradient-ring !border-[var(--ai-brand-soft)]" : "hover:border-[var(--ai-border-strong)]"}`}
                  onClick={() => set("style", s.id)}
                >
                  <span className="text-lg">{s.label.split(" ")[0]}</span>
                  <span className="mt-1 block text-sm font-bold">{s.label.split(" ").slice(1).join(" ")}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-[var(--ai-muted)]">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="ai-section-kicker">
              <span className="ai-dot" />
              Cores
            </span>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ai-card ai-card-pad text-left transition-colors ${form.color === c.id ? "ai-gradient-ring !border-[var(--ai-brand-soft)]" : "hover:border-[var(--ai-border-strong)]"}`}
                  onClick={() => set("color", c.id)}
                >
                  <span className="block text-sm font-bold">{c.label}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-[var(--ai-muted)]">{c.desc}</span>
                  {c.id === "custom" && form.color === "custom" ? (
                    <span className="mt-3 inline-flex items-center gap-2">
                      <input
                        type="color"
                        className="h-8 w-12 cursor-pointer rounded-md border border-[var(--ai-border)] bg-transparent"
                        value={/^#[0-9a-fA-F]{6}$/.test(form.customColor) ? form.customColor : "#E31E24"}
                        onChange={(e) => set("customColor", e.target.value)}
                        aria-label="Cor principal"
                      />
                      <input
                        className="ai-input !w-28 !py-1.5"
                        value={form.customColor}
                        onChange={(e) => set("customColor", e.target.value)}
                        placeholder="#E31E24"
                        maxLength={9}
                      />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="ai-section-kicker">
              <span className="ai-dot" />
              Tipografia
            </span>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {TYPOGRAPHY.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ai-card ai-card-pad text-left transition-colors ${form.typography === t.id ? "ai-gradient-ring !border-[var(--ai-brand-soft)]" : "hover:border-[var(--ai-border-strong)]"}`}
                  onClick={() => set("typography", t.id)}
                >
                  <span className="block text-lg font-extrabold">{t.label}</span>
                  <span className="mt-1 block text-xs text-[var(--ai-muted)]">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm font-semibold text-[#f26d6d]">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <button type="button" className="ai-btn ai-btn-ghost" onClick={back}>
              ← Voltar
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="ai-btn ai-btn-ghost" onClick={() => setStep(2)}>
                Ir para geração
              </button>
              <button type="button" className="ai-btn" onClick={generate}>
                ✨ Gerar site com IA
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ai-card ai-card-pad">
          <div className="max-w-xl">
            <span className="ai-section-kicker">
              <span className="ai-dot" />
              Geração em curso
            </span>
            <h2 className="ai-display mt-4 text-2xl md:text-3xl">
              A criar o website de{" "}
              <span className="ai-gradient-text">{form.businessName || "…"}</span>
            </h2>

            <ul className="mt-8 space-y-4">
              {GEN_STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={`ai-status-dot ${
                      i < phase ? "published" : i === phase ? "generating" : "draft"
                    }`}
                  />
                  <span className={`text-sm ${i <= phase ? "text-[var(--ai-ink)]" : "text-[var(--ai-muted)]"}`}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>

            {error ? (
              <p className="mt-6 rounded-lg border border-[#5c2c36] bg-[#2a1f1f] px-4 py-3 text-sm font-semibold text-[#f26d6d]">
                {error}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" className="ai-btn ai-btn-ghost" onClick={back}>
                ← Voltar
              </button>
              {error ? (
                <button type="button" className="ai-btn" onClick={generate}>
                  Tentar novamente
                </button>
              ) : (
                <span className="text-xs text-[var(--ai-muted)]">
                  Leva cerca de 30 a 60 segundos. Não feche esta página.
                </span>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}