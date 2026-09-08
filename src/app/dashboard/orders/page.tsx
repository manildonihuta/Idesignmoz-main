import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { OrdersView } from "@/components/orders-view";
import { getClientContext } from "@/lib/client";
import { listClientOrders } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Encomendas — Área de cliente",
};

export default async function DashboardOrdersPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const orders = await listClientOrders(ctx);

  return (
    <DashboardShell>
      <OrdersView orders={orders} />
    </DashboardShell>
  );
}
