import Link from "next/link";
import { formatMZN } from "@/lib/currency";
import type { HostingPlan } from "@/lib/hosting-plans";
import { CatalogAddButton } from "@/components/catalog-add-button";
import { HostingCard as HostingCardCore } from "@/components/ui/core";

export default function HostingCard({
  plan,
  headingTag: Heading = "h3",
}: {
  plan: HostingPlan;
  headingTag?: "h2" | "h3" | "h4";
}) {
  const specs = [
    { label: "Storage", value: plan.storage },
    { label: "Websites", value: plan.websites },
    { label: "Emails", value: plan.emails },
    { label: "Databases", value: plan.databases },
    { label: "SSL", value: plan.ssl },
    { label: "Backup", value: plan.backup },
    { label: "Support", value: plan.support },
  ];

  return (
    <HostingCardCore
      name={plan.name}
      description={plan.description}
      badge={plan.badge}
      featured={plan.featured}
      price={<>{formatMZN(plan.monthlyPrice)} MT</>}
      priceSuffix="/ month"
      priceNote={
        <>
          or <b className="text-paper">{formatMZN(plan.annualPrice)} MT</b> / year (save)
        </>
      }
      specs={specs}
      headingTag={Heading}
      actions={
        <>
          <Link className={`${plan.featured ? "button" : "outline-button"} w-full`} href={`/hosting/${plan.slug}`}>
            Get Started <span aria-hidden="true">↗</span>
          </Link>
          <CatalogAddButton productId={`hosting-${plan.slug}`} className="outline-button" />
        </>
      }
    />
  );
}