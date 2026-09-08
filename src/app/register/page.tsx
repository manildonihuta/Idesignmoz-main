import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Criar conta — IDesign Moz",
  description:
    "Crie a sua área de cliente para gerir domínios, alojamento, email e facturação.",
  path: "/register",
  noindex: true,
});

export default function RegisterPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap detail-page">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Área de cliente
          </p>
          <h1>
            Crie a sua<br />
            <em>conta.</em>
          </h1>
          <p>Uma conta para gerir domínios, alojamento, email e facturação.</p>
        </div>
        <div className="detail-layout">
          <div className="detail-list">
            {["Email com código de acesso", "Sem palavras-passe para memorizar", "Pagamentos e facturas num só lugar", "Suporte directo"].map(
              (item, index) => (
                <div key={item}>
                  <span>0{index + 1}</span>
                  <strong>{item}</strong>
                </div>
              ),
            )}
          </div>
          <div className="detail-aside">
            <p>
              O registo usa o Auth.js com acesso por email. Ele será enviado
              depois de confirmar estas variáveis de ambiente.
            </p>
            <Link className="button" href="/login">
              Iniciar sessão <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}