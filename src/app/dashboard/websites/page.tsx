import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { WebsitesView } from "@/components/websites-view";
import { getClientContext } from "@/lib/client";
import { listClientProjects } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Websites — Área de cliente",
};

export default async function DashboardWebsitesPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const projects = await listClientProjects(ctx);

  return (
    <DashboardShell>
      <WebsitesView projects={projects} />
    </DashboardShell>
  );
}
