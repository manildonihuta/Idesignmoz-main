import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Finalizar compra — IDesign Moz",
  description:
    "Complete a sua compra em 5 etapas: dados do cliente, produtos, facturação, pagamento e confirmação.",
  path: "/checkout",
  noindex: true,
  nofollow: true,
});

export default function CheckoutPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Finalizar compra
          </p>
          <h1>
            Um passo<br />
            <em>para ficar online.</em>
          </h1>
          <p>Confirme os seus dados e escolha como pagar. A activação é automática.</p>
        </div>
        <CheckoutForm />
      </main>
      <SiteFooter />
    </div>
  );
}
