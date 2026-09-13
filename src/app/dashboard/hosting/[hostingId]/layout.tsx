import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import ManageHostingShell from "@/components/hosting/manage-hosting-shell";
import { getClientContext } from "@/lib/client";
import { userOwnsHostingAccount } from "@/services/hosting-panel.service";

export const dynamic = "force-dynamic";

export default async function ManageHostingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ hostingId: string }>;
}) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) {
    redirect("/login");
  }

  const { hostingId } = await params;
  const owned = await userOwnsHostingAccount(ctx, hostingId);
  if (!owned) {
    redirect("/dashboard/hosting");
  }

  return (
    <DashboardShell>
      <ManageHostingShell hostingId={hostingId}>{children}</ManageHostingShell>
    </DashboardShell>
  );
}