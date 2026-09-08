import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Início — IDesign Moz",
  description:
    "Alojamento, domínios, websites, email e marketing digital em Moçambique.",
  path: "/home",
});

export default function HomePage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> A sua presença digital, tratada
          </p>
          <h1>
            Tudo para o seu negócio ficar<br />
            <em>online e a crescer.</em>
          </h1>
          <p>
            Domínios, alojamento, websites, email profissional e marketing —
            uma casa só, com suporte local em Maputo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="button" href="/domains">
              Procurar domínio ↗
            </Link>
            <Link className="outline-button" href="/hosting">
              Ver alojamento ↗
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            ["Domínios", "Encontre e registe o endereço certo.", "/domains"],
            ["Alojamento", "Planos simples, SSL e backups diários.", "/hosting"],
            ["Websites", "Presenças desenhadas para converter.", "/services"],
          ].map(([title, text, href]) => (
            <Link className="catalog-card" href={href} key={href}>
              <h2>{title}</h2>
              <p>{text}</p>
              <b>
                Explorar <span aria-hidden="true">↗</span>
              </b>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}