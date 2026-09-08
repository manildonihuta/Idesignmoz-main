import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmailsView } from "@/components/emails-view";
import { getClientContext } from "@/lib/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email — Área de cliente",
};

export default async function DashboardEmailPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  return (
    <DashboardShell>
      <EmailsView />
    </DashboardShell>
  );
}
