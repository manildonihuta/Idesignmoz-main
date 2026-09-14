import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { TemplatesGallery } from "@/components/templates-gallery";
import { getClientContext } from "@/lib/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Modelos de design — Área de cliente",
};

export default async function DashboardTemplatesPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  return (
    <DashboardShell user={ctx}>
      <div className="dash-templates">
        <TemplatesGallery />
      </div>
    </DashboardShell>
  );
}