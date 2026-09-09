import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import ManageDomainShell from "@/components/dns/manage-domain-shell";
import { getClientContext } from "@/lib/client";
import { userOwnsDomain } from "@/services/dns.service";

export const dynamic = "force-dynamic";

export default async function ManageDomainLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) {
    redirect("/login");
  }

  const { domain } = await params;
  const owned = await userOwnsDomain(ctx, domain);
  if (!owned) {
    redirect("/dashboard/domains");
  }

  return (
    <DashboardShell>
      <ManageDomainShell fullDomain={domain}>{children}</ManageDomainShell>
    </DashboardShell>
  );
}