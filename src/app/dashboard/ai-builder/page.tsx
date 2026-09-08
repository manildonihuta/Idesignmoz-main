import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { BuilderListView } from "@/components/ai-builder/builder-list-view";
import { getClientContext } from "@/lib/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criador de websites IA — Área de cliente",
};

export default async function AiBuilderDashboardPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  return (
    <DashboardShell>
      <BuilderListView />
    </DashboardShell>
  );
}