import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProjectsView } from "@/components/projects-view";
import { getClientContext } from "@/lib/client";
import { listClientProjects } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projectos — Área de cliente",
};

export default async function DashboardProjectsPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const projects = await listClientProjects(ctx);

  return (
    <DashboardShell user={ctx}>
      <ProjectsView projects={projects} />
    </DashboardShell>
  );
}
