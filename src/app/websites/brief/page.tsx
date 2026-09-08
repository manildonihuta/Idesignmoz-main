import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WebsiteBriefForm } from "@/components/website-brief-form";
import { getWebsitePackage } from "@/lib/website-packages";
import { formatMZN } from "@/lib/currency";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Briefing — IDesign Moz",
  description: "Descreva o seu projeto de website e receba uma proposta em minutos.",
  path: "/websites/brief",
});

export default async function WebsiteBriefPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const { package: packageSlug } = await searchParams;
  const pkg = packageSlug ? await getWebsitePackage(packageSlug) : null;
  if (!pkg) redirect("/websites");

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Briefing do projeto
          </p>
          <h1>
            Conte-nos o seu <em>projeto.</em>
          </h1>
          <p>
            Pacote selecionado: <b>{pkg.name}</b> · {formatMZN(pkg.price)} MT. Preencha o
            formulário abaixo — recebe de seguida a proposta para aprovar.
          </p>
        </div>
        <WebsiteBriefForm pkg={pkg} />
      </main>
      <SiteFooter />
    </div>
  );
}