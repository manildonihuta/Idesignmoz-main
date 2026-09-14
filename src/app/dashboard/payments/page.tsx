import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PaymentsView } from "@/components/payments-view";
import { getClientContext } from "@/lib/client";
import { listClientPayments } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pagamentos — Área de cliente",
};

export default async function DashboardPaymentsPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const payments = await listClientPayments(ctx);

  return (
    <DashboardShell user={ctx}>
      <PaymentsView payments={payments} />
    </DashboardShell>
  );
}
