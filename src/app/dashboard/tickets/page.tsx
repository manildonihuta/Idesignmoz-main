import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TicketsView } from "@/components/tickets-view";
import { getClientContext } from "@/lib/client";
import { listClientTickets } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tickets — Área de cliente",
};

export default async function DashboardTicketsPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const tickets = await listClientTickets(ctx);

  return (
    <DashboardShell>
      <TicketsView initialData={tickets} />
    </DashboardShell>
  );
}
