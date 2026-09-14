import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { SubscriptionsView } from "@/components/subscriptions-view";
import { getClientContext } from "@/lib/client";
import { listClientSubscriptions } from "@/services/billing.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscrições — Área de cliente",
};

export default async function DashboardSubscriptionsPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const subscriptions = await listClientSubscriptions(ctx);

  return (
    <DashboardShell user={ctx}>
      <SubscriptionsView subscriptions={subscriptions} />
    </DashboardShell>
  );
}