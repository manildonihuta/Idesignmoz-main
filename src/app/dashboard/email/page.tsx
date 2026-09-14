import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmailsView } from "@/components/emails-view";
import { getClientContext } from "@/lib/client";
import { listClientEmailServices } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email — Área de cliente",
};

export default async function DashboardEmailPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const services = await listClientEmailServices(ctx);

  return (
    <DashboardShell user={ctx}>
      <EmailsView services={services} />
    </DashboardShell>
  );
}