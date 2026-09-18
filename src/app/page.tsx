import type { Metadata } from "next";
import Link from "next/link";
import DomainSearch from "@/components/domain-search";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PricingCard, TestimonialCard } from "@/components/ui/core";
import {
  getHostingPlans,
  getProjects,
  getTestimonials,
} from "@/lib/content";
import { localBusinessSchema, seo } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { formatMZN } from "@/lib/currency";
import { FUTURE_FEATURES, type FutureFeature } from "@/lib/platform-futures";
import HeroAntigravity from "@/components/hero-antigravity";
import { SelectedWorksGrid } from "@/components/selected-works-grid";
import ThreeDTestimonials from "@/components/ui/3d-testimonails";

export const dynamic = "force-dynamic";

export const metadata: Metadata = seo({
  title: "IDesign Moz — Build your digital presence",
  description:
    "Pesquise o seu domínio, escolha alojamento, compre serviços e gerencie tudo numa única plataforma SaaS com suporte local em Maputo.",
  path: "/",
  keywords: ["plataforma digital", "SaaS", "domínio", "alojamento", "criar presença online", "Moçambique"],
});

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

const funnelSteps = [
  {
    n: "01",
    title: "Search Domain",
    text: "Encontre o endereço perfeito com preços reais por extensão.",
    href: "/domains/search",
    cta: "Procurar domínio",
  },
  {
    n: "02",
    title: "Choose Hosting",
    text: "Planos simples, SSL e backups diários para o seu espaço na web.",
    href: "/hosting",
    cta: "Ver planos",
  },
  {
    n: "03",
    title: "Buy Services",
    text: "Websites, branding, email e loja online prontos a comprar.",
    href: "/services",
    cta: "Explorar serviços",
  },
  {
    n: "04",
    title: "Manage Everything",
    text: "Um painel para domínios, alojamento, projetos e faturação.",
    href: "/dashboard",
    cta: "Abrir painel",
  },
];

const stageTitles: Record<FutureFeature["area"], string> = {
  commerce: "Venda & reseller",
  creators: "Para criadores",
  intelligence: "Inteligência",
  operations: "Operações",
};

function PlatformCard({ feature }: { feature: FutureFeature }) {
  const live = feature.status === "live" || feature.status === "beta";
  return (
    <Link
      href={feature.href}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6 transition-all hover:-translate-y-1 hover:border-brand"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg leading-tight tracking-tight text-paper">{feature.name}</h3>
        {live ? (
          <span className="rounded-full bg-brand/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
            {feature.status === "live" ? "Disponível" : "Beta"}
          </span>
        ) : (
          <span className="rounded-full border border-line px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
            Em breve
          </span>
        )}
      </div>
      <p className="text-sm text-muted">{feature.short}</p>
      <p className="mt-auto text-sm leading-relaxed text-muted/80">{feature.description}</p>
      <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
        Saber mais <Arrow />
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const [hostingPlans, projects, testimonials, settings] = await Promise.all([
    getHostingPlans(),
    getProjects(),
    getTestimonials(),
    getSiteSettings(),
  ]);

  const priceCards = hostingPlans.slice(0, 3);
  const platformAreas = ["commerce", "creators", "intelligence", "operations"] as const;

  const countryCode = /mozambique|moçambique/i.test(settings.general.country) ? "MZ" : "MZ";
  const jsonLd = localBusinessSchema({
    name: settings.general.siteName,
    email: settings.general.supportEmail,
    telephone: settings.whatsapp.phoneNumber,
    street: settings.general.address,
    city: settings.general.city,
    countryCode,
  });

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="hero-simple section-wrap relative overflow-hidden">
          <div className="absolute inset-0 z-0" aria-hidden="true">
            <HeroAntigravity />
          </div>
          <div className="relative z-10">
            <p className="eyebrow">
              <span className="pulse" /> One platform. Your digital presence.
            </p>
            <h1>
              Build your digital presence <em>with IDesign Moz.</em>
            </h1>
            <p className="hero-text">
              Domínios, alojamento, websites e serviços digitais — geridos a partir de uma única
              plataforma SaaS. Com suporte local em Maputo e espaço para crescer consigo.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link className="button" href="/domains/search">
                Search Domain <Arrow />
              </Link>
              <Link className="outline-button" href="/websites">
                Criar Site Grátis com IA <Arrow />
              </Link>
              <Link className="outline-button" href="/hosting">
                Choose Hosting <Arrow />
              </Link>
            </div>
            {/* Free builder note */}
            <p className="mt-4 text-center text-xs" style={{ color: "#777a72" }}>
              ✦ Website Builder 100% grátis · sem cartão · publique em segundos
            </p>
          </div>
        </section>

        {/* Domain search */}
        <section className="domain-panel section-wrap" id="domains" aria-labelledby="domain-heading">
          <div className="domain-heading domain-heading-center">
            <h2 id="domain-heading">
              Search your <em>domain.</em>
            </h2>
          </div>
          <DomainSearch />
          <div className="domain-foot">
            <span>Popular extensions</span>
            <b>.com</b>
            <span>.co.mz</span>
            <span>.net</span>
            <span>.org</span>
            <span>.africa</span>
          </div>
        </section>

        {/* The four-step journey */}
        <section className="services-section section-wrap" id="how-it-works">
          <div className="section-kicker">
            <span>01</span>
            <span className="rule" />
            <span>Como funciona</span>
          </div>
          <div className="section-intro">
            <h2>
              Uma plataforma, <em>quatro passos.</em>
            </h2>
            <p>Do primeiro domínio ao painel de gestão, sem sair do mesmo ecossistema.</p>
          </div>
          <div className="case-grid">
            {funnelSteps.map((step) => (
              <Link key={step.n} className="case-card" href={step.href}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <b style={{ color: "var(--lime)", fontSize: 12, marginTop: "auto" }}>
                  {step.cta} <Arrow />
                </b>
              </Link>
            ))}
          </div>
        </section>

        {/* Free AI Website Builder Promo */}
        <section className="section-wrap" aria-labelledby="ai-builder-promo-heading">
          <div
            className="rounded-2xl border p-6 md:p-10"
            style={{
              background: "linear-gradient(135deg, #181d12 0%, #0b0c0a 100%)",
              borderColor: "rgba(230,0,35,0.18)",
            }}
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-5 max-w-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="site-status live">Disponível Agora</span>
                  <span
                    style={{ border: "1px solid rgba(230,0,35,0.35)", color: "#e60023" }}
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                  >
                    0 MT · Totalmente Grátis
                  </span>
                </div>
                <h2 id="ai-builder-promo-heading" className="text-2xl font-semibold tracking-tight text-paper md:text-3xl">
                  Crie o seu website com IA{" "}
                  <em className="font-extrabold not-italic" style={{ color: "var(--lime)" }}>em menos de 1 minuto.</em>
                </h2>
                <p className="text-sm leading-relaxed text-muted">
                  Sem cartão de crédito, designer ou programador. Descreva o negócio, escolha o estilo e a IA gera textos, estrutura e cores. Publique grátis ou registe o seu domínio{" "}
                  <b className="text-paper">.co.mz</b> a partir de 900 MT/ano.
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted sm:grid-cols-4">
                  {[
                    { icon: "🎯", label: "Geração com IA" },
                    { icon: "✏️", label: "Editor visual" },
                    { icon: "🌐", label: "Domínio .co.mz" },
                    { icon: "🚀", label: "Publicação instantânea" },
                  ].map((item) => (
                    <span key={item.label} className="flex items-center gap-1.5">
                      <span>{item.icon}</span> {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                <Link className="button" href="/websites">
                  Criar Site Grátis agora <Arrow />
                </Link>
                <Link className="outline-button" href="/domains/search">
                  Pesquisar Domínio .co.mz <Arrow />
                </Link>
                <p className="text-[11px] text-muted">Sem compromisso · 100% grátis para sempre.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Hosting */}
        <section className="hosting-section section-wrap" id="hosting">
          <div className="hosting-copy">
            <div className="section-kicker">
              <span>02</span>
              <span className="rule" />
              <span>Alojamento, simplificado</span>
            </div>
            <h2>
              Mantenha o seu <em>espaço na web</em> sempre aberto.
            </h2>
            <p>Alojamento fiável com suporte local, segurança integrada e espaço para o que vem a seguir.</p>
            <a className="text-link" href="#pricing">
              Comparar planos <Arrow />
            </a>
          </div>
          <div className="hosting-card-wrap">
            <div className="hosting-status">
              <span className="status-dot" /> Todos os sistemas operacionais{" "}
              <small>99,99% de disponibilidade</small>
            </div>
            <div className="hosting-terminal">
              <div className="terminal-top">
                <span>idesignmoz / painel</span>
                <i>•••</i>
              </div>
              <div className="terminal-stat">
                <span>VISITANTES MENSAIS</span>
                <strong>24.891</strong>
                <b>+18,4%</b>
              </div>
              <div className="chart">
                {Array.from({ length: 12 }, (_, index) => (
                  <i key={index} />
                ))}
              </div>
              <div className="terminal-bottom">
                <span>SSL activo</span>
                <span>Backups diários</span>
                <span>Maputo / MZ</span>
              </div>
            </div>
          </div>
        </section>

        {/* Platform / future roadmap */}
        <section className="services-section section-wrap" id="platform">
          <div className="section-kicker">
            <span>03</span>
            <span className="rule" />
            <span>Uma plataforma que cresce consigo</span>
          </div>
          <div className="section-intro">
            <h2>
              Feito para ser <em>o seu painel.</em>
            </h2>
            <p>
              Desenhada de forma modular, a IDesign Moz evolui sem reconstruir o sistema — do
              website builder à IA, passando por revenda e marketplace.
            </p>
          </div>
          <div className="flex flex-col gap-8">
            {platformAreas.map((area) => {
              const features = FUTURE_FEATURES.filter((f) => f.area === area);
              if (!features.length) return null;
              return (
                <div key={area}>
                  <div className="mb-4 text-xs font-bold uppercase tracking-widest text-brand">
                    {stageTitles[area]}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                      <PlatformCard key={feature.id} feature={feature} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Work / portfolio */}
        <SelectedWorksGrid projects={projects} />

        {/* Pricing */}
        <section className="services-section section-wrap" id="pricing">
          <div className="section-kicker">
            <span>05</span>
            <span className="rule" />
            <span>Preços simples</span>
          </div>
          <div className="section-intro">
            <h2>
              Espaço para crescer. <em>Sem surpresas.</em>
            </h2>
            <p>Comece com o que precisa hoje. Faça upgrade quando chegar a altura.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {priceCards.map((plan) => (
              <PricingCard
                key={plan.slug}
                title={plan.name}
                description={plan.description}
                price={formatMZN(plan.monthlyPrice)}
                period="MT / mês"
                features={plan.features.slice(0, 3)}
                featured={plan.featured}
                popularLabel={plan.featured ? "Mais escolhido" : undefined}
                cta={{
                  label: (
                    <>
                      Escolher {plan.name} <Arrow />
                    </>
                  ),
                  href: `/hosting/${plan.slug}`,
                }}
              />
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="services-section section-wrap" id="testimonials">
          <div className="section-kicker">
            <span>06</span>
            <span className="rule" />
            <span>O que dizem os clientes</span>
          </div>
          <div className="section-intro">
            <h2>
              A confiança <em>vem por provas.</em>
            </h2>
            <p>Palavras de quem já trabalha connosco e com os nossos sistemas.</p>
          </div>
          <ThreeDTestimonials
            testimonials={testimonials.map((t) => ({
              name: t.name,
              role: t.role,
              body: t.quote,
            }))}
          />
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}