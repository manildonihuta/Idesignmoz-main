"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { BuilderSite } from "@/services/ai-builder.service";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  generating: "A gerar…",
  ready: "Pronto",
  failed: "Falhou",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_DOT: Record<string, string> = {
  draft: "draft",
  generating: "generating",
  ready: "generating",
  failed: "failed",
  published: "published",
  archived: "failed",
};

const QUICK_PROMPTS: { icon: string; label: string; text: string }[] = [
  {
    icon: "🍽️",
    label: "Restaurante",
    text: "Restaurante de cozinha moçambicana no centro de Maputo. Ambiente familiar, pratos de matapa, caril e grelhados. Quero destacar o menu, reservas e os horários.",
  },
  {
    icon: "🏨",
    label: "Hotel",
    text: "Hotel boutique em Inhambane. 12 quartos virados para a praia, pequeno-almoço incluído, passeios de dhow e mergulho. Preciso de mostrar os quartos, preços e formulário de reserva.",
  },
  {
    icon: "🎨",
    label: "Portfólio",
    text: "Portfólio de designer gráfico freelancer em Maputo. Quero apresentar os meus projetos, serviços de branding e contactos para novos clientes.",
  },
  {
    icon: "💼",
    label: "Negócio",
    text: "Escritório de contabilidade e consultoria empresarial. Serviços de contabilidade, auditoria e registo de empresas. Tom profissional e de confiança.",
  },
  {
    icon: "🛍️",
    label: "Loja online",
    text: "Loja online de artesanato moçambicano: cestos, capulanas, esculturas em madeira e joias. Vou vender para todo o país com entrega em Maputo, Matola e Beira.",
  },
  {
    icon: "🏡",
    label: "Imobiliário",
    text: "Imobiliária em Maputo focada em venda e arrendamento de apartamentos e vivendas. Quero mostrar imóveis disponíveis, zonas e contactos para visitas.",
  },
  {
    icon: "🚀",
    label: "Landing page",
    text: "Landing page para o lançamento de um novo serviço de entrega de refeições ao domicílio. Quero chamada à ação clara, vantagens e preço promocional.",
  },
];

type VoiceRecognition = {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = {
  SpeechRecognition?: new () => VoiceRecognition;
  webkitSpeechRecognition?: new () => VoiceRecognition;
};

function getRecognition(): VoiceRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as SpeechRecognitionWindow;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export function BuilderDashboard() {
  const router = useRouter();
  const [sites, setSites] = useState<BuilderSite[]>([]);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/ai-builder/sites")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setSites(data.sites ?? []);
          if (data.quota) setQuota(data.quota);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const quotaFull = quota !== null && quota.used >= quota.limit;

  function goToWizard(brief: string) {
    const query = brief.trim() ? `?brief=${encodeURIComponent(brief.trim())}` : "";
    router.push(`/dashboard/ai-builder/new${query}`);
  }

  function toggleVoice() {
    if (listening) {
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      setError("a opção de voz não está disponível neste browser.");
      return;
    }
    setError(null);
    rec.lang = "pt-MZ";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      setPrompt((p) => (p ? `${p} ${text}` : text).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <div className="ai-font space-y-10">
      <nav className="breadcrumbs" aria-label="Navegação">
        <Link href="/dashboard">Início</Link>
        <span>/</span>
        Criar com IA
      </nav>

      <section className="ai-card relative overflow-hidden p-8 md:p-12">
        <div className="ai-glow right-[-120px] top-[-120px] h-[360px] w-[360px]" />
        <div className="relative z-10 max-w-2xl">
          <span className="ai-section-kicker">
            <span className="ai-dot" />
            IDesign AI Builder
          </span>
          <h1 className="ai-display mt-5 text-4xl md:text-6xl">
            Transforme a sua ideia
            <br />
            num <span className="ai-gradient-text">website</span>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[var(--ai-muted)]">
            Descreva o seu negócio e a inteligência artificial desenha um site
            completo em português de Moçambique — textos, páginas e estilo únicos,
            prontos a publicar.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link className="ai-btn" href="/dashboard/ai-builder/new">
              ✨ Criar com IA
            </Link>
            <Link className="ai-btn ai-btn-ghost" href="/templates">
              Ver modelos de design
            </Link>
          </div>
        </div>
      </section>

      {quotaFull ? (
        <div
          className="ai-card flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: "rgba(227,30,36,.45)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <p className="text-sm text-[var(--ai-ink)]">
              Atingiu o limite de <b>{quota.limit}</b> sites gratuitos com IA. Faça upgrade
              para criar mais websites.
            </p>
          </div>
          <Link className="ai-btn" href="/pricing">
            Ver planos
          </Link>
        </div>
      ) : null}

      <section>
        <span className="ai-section-kicker">
          <span className="ai-dot" />
          Descreva o que quer criar
        </span>
        <div className="mt-4 ai-prompt-box">
          <span className="ai-glow left-[-60px] bottom-[-60px] h-[200px] w-[200px]" />
          {error ? (
            <p className="mb-3 text-xs font-semibold text-[#f26d6d]">{error}</p>
          ) : null}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva o seu website… Ex.: restaurante de cozinha moçambicana em Maputo, com o menu, reservas e contactos."
            maxLength={4000}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="ai-btn ai-btn-ghost !px-3 !py-2 text-sm"
                onClick={toggleVoice}
                aria-label={listening ? "Parar gravação" : "Gravar com voz"}
                title={listening ? "Parar gravação" : "Gravar com voz"}
              >
                {listening ? "■" : "🎙️"} {listening ? "A ouvir…" : "Voz"}
              </button>
              <span className="text-xs text-[var(--ai-muted)]">
                gerado em pt-MZ · sugestões abaixo
              </span>
            </div>
            <button
              type="button"
              className="ai-btn"
              onClick={() => goToWizard(prompt)}
              disabled={!prompt.trim()}
            >
              ✨ Gerar site
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="ai-chip"
              onClick={() => {
                setPrompt(chip.text);
                textareaRef.current?.focus();
              }}
            >
              <span className="ai-chip-icon">{chip.icon}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <span className="ai-section-kicker">
            <span className="ai-dot" />
            Os meus websites
          </span>
          <Link className="text-xs font-bold text-[var(--ai-brand-soft)]" href="/dashboard/ai-builder/new">
            + Novo site
          </Link>
        </div>

        {loading && (
          <div className="ai-card ai-card-pad text-sm text-[var(--ai-muted)]">
            A carregar…
          </div>
        )}
        {!loading && sites.length === 0 && (
          <div className="ai-card">
            <div className="ai-card-pad flex flex-col items-start gap-3">
              <span className="ai-gradient-text text-2xl">🚀</span>
              <p className="text-sm text-[var(--ai-muted)]">
                Ainda não gerou nenhum website. Comece por uma descrição no campo
                acima ou veja os modelos de design.
              </p>
              <Link className="ai-btn mt-1" href="/dashboard/ai-builder/new">
                ✨ Criar o meu primeiro site
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {sites.map((site) => (
            <Link
              key={site.id}
              className="ai-card ai-card-pad group flex flex-col gap-3 transition-colors hover:border-[var(--ai-border-strong)]"
              href={`/dashboard/ai-builder/${site.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="ai-gradient-bg grid h-11 w-11 flex-none place-items-center rounded-xl text-lg font-extrabold">
                  {site.businessName.charAt(0) || "S"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-bold">
                    {site.businessName}
                  </h3>
                  <p className="truncate text-xs text-[var(--ai-muted)]">
                    {site.domain ?? "Sem domínio"} ·{" "}
                    {new Date(site.createdAt).toLocaleDateString("pt-MZ")}
                  </p>
                </div>
                <span className="ai-badge">
                  <span className={`ai-status-dot ${STATUS_DOT[site.status] ?? "draft"}`} />
                  {STATUS_LABEL[site.status] ?? site.status}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--ai-border)] pt-3 text-xs">
                <span className="text-[var(--ai-muted)]">Website IA</span>
                <span className="font-bold text-[var(--ai-brand-soft)] transition-transform group-hover:translate-x-1">
                  Abrir editor →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}