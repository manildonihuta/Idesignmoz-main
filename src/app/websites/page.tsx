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
        <div className="page-hero page-hero-split">
          <div>
            <p className="eyebrow">
              <span className="pulse" /> Websites, sem complicações
            </p>
            <h1>
              Um website que<br />
              trabalha<br />
              <em>por si.</em>
            </h1>
          </div>
          <p>
            Escolha um pacote, descreva o seu negócio num briefing simples e
            receba uma proposta em minutos. Aprovou? Nós tratamos do resto —
            desde o domínio ao dia do lançamento.
          </p>
        </div>

        {packages.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não há pacotes de websites disponíveis. Fale connosco para um
            orçamento à medida.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <li><b>1 · Escolha</b> o pacote que encaixa no seu negócio.</li>
            <li><b>2 · Briefing</b> — descreva o objetivo, páginas e prazo.</li>
            <li><b>3 · Proposta</b> — receba o orçamento e aprove online.</li>
            <li><b>4 · Lancamento</b> — acompanhe o progresso no painel.</li>
          </ol>
        </div>
      </main>
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}