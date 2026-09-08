import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, seo } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = seo({
  title: "Política de Privacidade — IDesign Moz",
  description:
    "Como a IDesign Moz recolhe, utiliza e protege os seus dados pessoais em conformidade com a legislação aplicável.",
  path: "/privacy",
  keywords: ["política de privacidade", "dados pessoais", "IDesign Moz"],
});

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  const { supportPhone } = settings.general;
  const jsonLd = breadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Política de Privacidade", path: "/privacy" },
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
            <h1>Política de Privacidade</h1>
          </div>
          <p>
            Esta política explica que dados recolhemos, como os usamos e os
            direitos que tem sobre eles.
          </p>
        </div>

        <div className="prose-content">
          <section className="legal-section">
            <h2>Dados que recolhemos</h2>
            <p>
              Recolhemos os dados que nos fornece directamente: nome, endereço de
              e-mail, telefone e dados de facturação. Recolhemos também dados de
              utilização do site, como páginas visitadas e origem do acesso.
            </p>
          </section>

          <section className="legal-section">
            <h2>Como usamos os dados</h2>
            <p>
              Utilizamos os seus dados para prestar os serviços contratados,
              processar pagamentos, enviar comunicações relacionadas com contas e
              suporte, e melhorar o desempenho do site. Não vendemos os seus dados
              a terceiros.
            </p>
          </section>

          <section className="legal-section">
            <h2>Cookies e analytics</h2>
            <p>
              Utilizamos cookies e ferramentas de análise para compreender o
              tráfego e melhorar a experiência. Pode controlar cookies através das
              definições do seu navegador.
            </p>
          </section>

          <section className="legal-section">
            <h2>Partilha com terceiros</h2>
            <p>
              Partilhamos dados apenas com fornecedores essenciais ao serviço
              (processamento de pagamentos, registo de domínios e alojamento),
              sempre com o mínimo necessário e dentro das garantias contratuais.
            </p>
          </section>

          <section className="legal-section">
            <h2>Retenção e segurança</h2>
            <p>
              Mantemos os seus dados apenas pelo tempo necessário e aplicamos
              medidas técnicas e organizativas para os proteger contra acesso não
              autorizado, perda ou alteração.
            </p>
          </section>

          <section className="legal-section">
            <h2>Os seus direitos</h2>
            <p>
              Pode solicitar acesso, correcção ou eliminação dos seus dados, bem
              como limitar ou opor-se a determinados tratamentos. Para exercer
              estes direitos, contacte-nos pelos canais abaixo.
            </p>
          </section>

          <section className="legal-section">
            <h2>Contacto</h2>
            <p>
              Para questões de privacidade, contacte-nos pelo formulário em{" "}
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