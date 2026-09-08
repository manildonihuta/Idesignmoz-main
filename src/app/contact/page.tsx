import type { Metadata } from "next";
import ContactView from "@/components/contact-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, localBusinessSchema, seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Contacto — IDesign Moz",
  description:
    "Fale com a IDesign Moz em Maputo: websites, domínios, alojamento, branding e marketing digital para o seu negócio.",
  path: "/contact",
  keywords: ["contacto", "fale connosco", "Maputo", "orçamento site"],
});

export default function ContactPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <ContactView />
      <SiteFooter />
      <JsonLd
        data={[
          localBusinessSchema(),
          breadcrumbSchema([
            { name: "Início", path: "/" },
            { name: "Contacto", path: "/contact" },
          ]),
        ]}
      />
    </div>
  );
}