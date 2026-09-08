import type { Metadata } from "next";
import DomainsView from "@/components/domains-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, productSchema, seo } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const metadata: Metadata = seo({
  title: "Domínios — IDesign Moz",
  description:
    "Pesquise e registe domínios .co.mz, .com, .africa e mais, com preços em Meticais e suporte local em Maputo.",
  path: "/domains",
  keywords: ["registar domínio", "domínio co.mz", "comprar domínio", "pesquisa de domínio"],
});

type DomainRow = { extension: string; registration: number; renewal: number; ideal_for: string | null };

export default async function DomainsPage() {
  const { data } = await supabaseAdmin
    .from("domain_extensions")
    .select("extension, registration, renewal, ideal_for")
    .eq("active", true)
    .order("registration", { ascending: true });

  const domainProducts = (data ?? []).map((p: DomainRow) => ({
    name: p.extension,
    description: p.ideal_for ?? `O domínio ${p.extension} para o seu negócio.`,
    url: "/domains",
    price: p.registration,
  }));

  return (
    <div className="site-shell">
      <SiteHeader />
      <DomainsView initialExtensions={data ?? []} />
      <SiteFooter />
      <JsonLd
        data={[
          ...domainProducts.map((p) => productSchema(p)),
          breadcrumbSchema([
            { name: "Início", path: "/" },
            { name: "Domínios", path: "/domains" },
          ]),
        ]}
      />
    </div>
  );
}