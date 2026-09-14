import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import DomainManager from "@/components/domain-manager";
import { getClientContext } from "@/lib/client";
import { listOwnedDomains } from "@/lib/domain-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Domínios — Área de cliente",
};

export default async function DashboardDomainsPage() {
  const ctx = await getClientContext();

  if (!ctx.authenticated) {
    redirect("/login");
  }

  const domains = await listOwnedDomains(ctx);

  return (
    <DashboardShell user={ctx}>
      <DomainManager domains={domains} />
    </DashboardShell>
  );
}