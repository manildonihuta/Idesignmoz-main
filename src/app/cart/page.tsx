import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Carrinho — IDesign Moz",
  description: "O seu carrinho de compras.",
  path: "/cart",
  noindex: true,
});

export default function CartPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Carrinho
          </p>
          <h1>
            O que está<br />
            <em>pronto a avançar.</em>
          </h1>
          <p>Domínios e planos que escolheu ficam aqui, prontos para a finalização.</p>
        </div>
        <CartView />
      </main>
      <SiteFooter />
    </div>
  );
}