import { redirect } from "next/navigation";
import DashboardWithCollapsibleSidebar from "@/components/ui/dashboard-with-collapsible-sidebar";
import { getAdminContext, fetchAdminDashboard } from "@/lib/admin";
import { getCompanyInfo } from "@/lib/site-settings";
import { getProposalCatalog } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await getAdminContext();

  if (!ctx.authenticated) {
    redirect("/login");
  }
  if (!ctx.isAdmin) {
    redirect("/");
  }

  const data = await fetchAdminDashboard();
  const company = await getCompanyInfo();
  const proposalCatalog = await getProposalCatalog();

  return (
    <DashboardWithCollapsibleSidebar
      adminEmail={ctx.email}
      adminUserId={ctx.userId}
      messages={data.messages}
      orders={data.orders}
      domains={data.domains}
      profiles={data.profiles}
      emailByUserId={data.emailByUserId}
      subscriptions={data.subscriptions}
      company={company}
      proposalCatalog={proposalCatalog}
    />
  );
}