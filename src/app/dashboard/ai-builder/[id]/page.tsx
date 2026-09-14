import { redirect, notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { BuilderEditor } from "@/components/ai-builder/builder-editor";
import { getClientContext } from "@/lib/client";
import { getSite } from "@/services/ai-builder.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editor de site IA — Área de cliente",
};

export default async function AiBuilderEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { id } = await params;
  const result = await getSite(ctx, id);
  if (!result.ok) notFound();

  return (
    <DashboardShell user={ctx}>
      <BuilderEditor initialSite={result.site} />
    </DashboardShell>
  );
}