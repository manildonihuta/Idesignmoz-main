import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, seo } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = seo({
  title: "Termos de Utilização — IDesign Moz",
  description:
    "Termos e condições que regem a utilização dos serviços de design, domínios, alojamento e marketing digital da IDesign Moz.",
  path: "/terms",
  keywords: ["termos de utilização", "condições", "IDesign Moz"],
});

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const { supportPhone } = settings.general;
  const jsonLd = breadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Termos de Utilização", path: "/terms" },
  ]);

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero page-hero-split">
          <div>
            <p className="eyebrow">
              <span className="pulse" /> Legal
            </p>
            <h1>Termos de Utilização</h1>
          </div>
          <p>
            Estes termos descrevem as condições em que a IDesign Moz presta
            serviços de design, domínios, alojamento e marketing digital em
            Moçambique.
          </p>
        </div>

        <div className="prose-content">
          <section className="legal-section">
            <h2>Aceitação dos termos</h2>
            <p>
              Ao aceder ao site ou contratar qualquer serviço, confirma que leu,
              compreendeu e aceita estes termos na sua totalidade. Se não
              concordar com qualquer parte, não deve utilizar os nossos serviços.
            </p>
          </section>

          <section className="legal-section">
            <h2>Serviços</h2>
            <p>
              A IDesign Moz presta design de websites, e-commerce, branding, SEO,
              marketing digital, registo de domínios e alojamento. O âmbito,
              prazos e entregáveis de projectos por medida são definidos em
              proposta previamente aprovada pelo cliente.
            </p>
          </section>

          <section className="legal-section">
            <h2>Preços e pagamentos</h2>
            <p>
              Os preços são apresentados em Meticais e podem variar conforme o
              plano escolhido. Os domínios e planos de alojamento são cobrados
              periodicamente; a falta de pagamento pode resultar na suspensão ou
              no cancelamento do serviço.
            </p>
          </section>

          <section className="legal-section">
            <h2>Contas e segurança</h2>
            <p>
              É responsável por manter a confidencialidade das suas credenciais e
              por todas as actividades realizadas na sua conta. Deve notificar-nos
              imediatamente de qualquer utilização não autorizada.
            </p>
          </section>

          <section className="legal-section">
            <h2>Propriedade intelectual</h2>
            <p>
              O conteúdo do site (textos, imagens, logótipos e código) pertence à
              IDesign Moz ou aos respectivos autores. Os projectos entregues são
              propriedade do cliente após pagamento integral.
            </p>
          </section>

          <section className="legal-section">
            <h2>Limitação de responsabilidade</h2>
            <p>
              Fazemos o melhor para garantir disponibilidade e qualidade, mas não
              garantimos que o serviço seja ininterrupto ou livre de erros. A
              responsabilidade da IDesign Moz limita-se ao valor pago pelo serviço
              em causa.
            </p>
          </section>

          <section className="legal-section">
            <h2>Contacto</h2>
            <p>
              Para questões sobre estes termos, contacte-nos pelo formulário em{" "}
              <Link href="/contact">/contact</Link> ou pelo WhatsApp: {supportPhone}.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
      <JsonLd data={jsonLd} />
    </div>
  );
}