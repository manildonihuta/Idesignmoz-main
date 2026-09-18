import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { formatMZN } from "@/lib/currency";
import { listWebsitePackages } from "@/lib/website-packages";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, productSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Websites — IDesign Moz",
  description: "Sites institucionais, landing pages e lojas online criados por uma equipa em Moçambique. Comece hoje com um briefing simples.",
  path: "/websites",
  keywords: ["criação de websites", "sites", "loja online", "Moçambique", "web design"],
});

export default async function WebsitesPage() {
  const packages = await listWebsitePackages();

  const jsonLd = [
    ...packages.map((pkg) =>
      productSchema({
        name: pkg.name,
        description: pkg.description ?? "",
        url: absoluteUrl(`/websites`),
        price: pkg.price,
      }),
    ),
    breadcrumbSchema([
      { name: "Início", path: "/" },
      { name: "Websites", path: "/websites" },
    ]),
  ];

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        {/* Hero */}
        <div className="page-hero page-hero-split">
          <div>
            <p className="eyebrow">
              <span className="pulse" /> Websites com Inteligência Artificial
            </p>
            <h1>
              Crie o seu site <br />
              <strong>100% Grátis</strong> com IA<br />
              <em>em segundos.</em>
            </h1>
          </div>
          <p>
            Gere a estrutura, textos e imagens do seu negócio sem pagar nada. Publicado instantaneamente com endereço temporário grátis ou adicione o seu domínio personalizado (.co.mz, .com) quando quiser!
          </p>
        </div>

        {/* Free AI Builder Featured Banner */}
        <div className="mt-8 rounded-2xl border border-brand/40 bg-gradient-to-r from-brand/10 via-surface to-surface p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="site-status live">Plano 0 MT · Grátis para Sempre</span>
                <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-bold text-brand">Geração com IA</span>
              </div>
              <h2 className="font-display-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Criação de Website Grátis no Website Builder
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                Não precisa de cartão de crédito. Crie o seu site com IA em menos de 1 minuto, edite secções visualmente e publique em <code className="text-paper">idesignmoz.site</code>. Quando o seu negócio crescer, associe o seu domínio próprio (<code className="text-paper">.co.mz</code>, <code className="text-paper">.com</code>) diretamente do painel!
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col xl:flex-row">
              <Link className="button button-small" href="/dashboard/ai-builder/new">
                Criar Site Grátis com IA ↗
              </Link>
              <Link className="outline-button outline-button-small" href="/domains/search">
                Pesquisar Domínio (.co.mz) ↗
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="font-display-2 text-xl font-semibold tracking-tight">Pacotes & Serviços por Encomenda</h2>
          <p className="text-sm text-muted">Para empresas que procuram design 100% exclusivo e desenvolvimento por medida.</p>
        </div>

        {packages.length === 0 ? (
          <div className="mt-4 rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não há pacotes de websites disponíveis. Fale connosco para um
            orçamento à medida.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <article key={pkg.id} className="rounded-xl border border-line bg-surface p-6 flex flex-col">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-display-2 text-xl font-semibold tracking-tight">{pkg.name}</h3>
                  {pkg.popular ? (
                    <span className="site-status live">Popular</span>
                  ) : null}
                </div>
                <p className="text-sm text-muted">{pkg.description ?? ""}</p>

                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {formatMZN(pkg.price)}
                  <span className="text-sm font-normal text-muted"> MT</span>
                </p>

                {pkg.features.length > 0 ? (
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {pkg.features.map((feature) => (
                      <li className="flex items-start gap-2" key={feature.label}>
                        <span aria-hidden="true">✓</span>
                        <span>
                          {feature.label}
                          {feature.note ? <span className="text-muted"> — {feature.note}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Link
                  className={pkg.popular ? "button mt-6 w-full" : "outline-button mt-6 w-full"}
                  href={`/websites/brief?package=${encodeURIComponent(pkg.slug)}`}
                >
                  Começar projeto <span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-line bg-surface p-6">
          <h2 className="font-display-2 text-lg font-semibold tracking-tight">Como funciona</h2>
          <ol className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
            <li><b>1 · Crie Grátis</b> com IA ou escolha um pacote feito à medida.</li>
            <li><b>2 · Personalize</b> os seus conteúdos, cores e serviços online.</li>
            <li><b>3 · Registe Domínio</b> (.co.mz, .com) para passar imagem de confiança.</li>
            <li><b>4 · Lançamento</b> — publique online instantaneamente.</li>
          </ol>
        </div>
      </main>
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}