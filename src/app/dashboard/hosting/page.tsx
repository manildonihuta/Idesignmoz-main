import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { HostingAccountsView } from "@/components/hosting-accounts-view";
import { getClientContext } from "@/lib/client";
import { listClientHostingAccounts } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alojamento — Área de cliente",
};

export default async function DashboardHostingPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const accounts = await listClientHostingAccounts(ctx);

  return (
    <DashboardShell>
      <HostingAccountsView accounts={accounts} />
    </DashboardShell>
  );
}
