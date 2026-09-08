import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, seo } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = seo({
  title: "Política de Reembolso — IDesign Moz",
  description:
    "Condições e prazos para pedidos de reembolso de serviços de domínios, alojamento e projetos da IDesign Moz.",
  path: "/refund-policy",
  keywords: ["reembolso", "política de reembolso", "IDesign Moz"],
});

export default async function RefundPolicyPage() {
  const settings = await getSiteSettings();
  const { supportPhone } = settings.general;
  const jsonLd = breadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Política de Reembolso", path: "/refund-policy" },
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
            <h1>Política de Reembolso</h1>
          </div>
          <p>
            Queremos que fique satisfeito com qualquer serviço que adquira.
            Eis como tratamos os reembolsos.
          </p>
        </div>

        <div className="prose-content">
          <section className="legal-section">
            <h2>Serviços digitais</h2>
            <p>
              Para projectos de design, e-commerce, branding, SEO e marketing,
              concedemos um período de 14 dias a contar do pagamento inicial para
              solicitar reembolso, desde que o trabalho não tenha sido iniciado.
              Após o início do projecto, o pagamento é considerado não reembolsável.
            </p>
          </section>

          <section className="legal-section">
            <h2>Domínios e registos</h2>
            <p>
              O registo de domínios é um serviço não reembolsável após a sua
              activação, uma vez que envolve custos de registo junto do
              respectivo registo. Renovações efectuadas não podem ser revertidas.
            </p>
          </section>

          <section className="legal-section">
            <h2>Alojamento</h2>
            <p>
              Planos de alojamento mensais podem ser cancelados em qualquer
              momento, com efeito no fim do ciclo de facturação. O valor já pago
              do mês corrente não é reembolsado.
            </p>
          </section>

          <section className="legal-section">
            <h2>Como pedir um reembolso</h2>
            <p>
              Envie o pedido pelos canais oficiais indicando o número da fatura
              (factura) e o motivo. Processamos os pedidos elegíveis até 10 dias
              úteis após validação, devolvendo o valor pela mesma via de
              pagamento.
            </p>
          </section>

          <section className="legal-section">
            <h2>Contacto</h2>
            <p>
              Para pedidos de reembolso, contacte-nos pelo formulário em{" "}
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