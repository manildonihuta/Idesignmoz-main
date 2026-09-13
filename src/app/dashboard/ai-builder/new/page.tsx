import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { BuilderWizard } from "@/components/ai-builder/builder-wizard";
import { getClientContext } from "@/lib/client";
import { getAiTemplate } from "@/lib/ai-templates";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criar com IA — Área de cliente",
};

type Props = { searchParams: Promise<{ brief?: string; template?: string }> };

export default async function NewAiBuilderPage({ searchParams }: Props) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { brief, template } = await searchParams;
  return (
    <DashboardShell>
      <BuilderWizard
        initialBrief={brief ?? ""}
        initialTemplate={getAiTemplate(template ?? null)}
      />
    </DashboardShell>
  );
}