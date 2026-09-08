import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardOverview } from "@/components/dashboard-overview";
import { getClientContext } from "@/lib/client";
import { countClientItems, listClientOwnedCategories } from "@/lib/client-data";
import { getCrossSellOffers } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Área de cliente — IDesign Moz",
};

export default async function DashboardOverviewPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const [counts, owned] = await Promise.all([
    countClientItems(ctx),
    listClientOwnedCategories(ctx),
  ]);
  const offers = await getCrossSellOffers(owned);

  return (
    <DashboardShell>
      <DashboardOverview counts={counts} offers={offers} />
    </DashboardShell>
  );
}
