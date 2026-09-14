import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmailServiceView } from "@/components/email-service-view";
import { getClientContext } from "@/lib/client";
import { getClientEmailService } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email — Área de cliente",
};

export default async function DashboardEmailServicePage({
  params,
}: {
  params: Promise<{ emailId: string }>;
}) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { emailId } = await params;
  const service = await getClientEmailService(ctx, emailId);
  if (!service) redirect("/dashboard/email");

  return (
    <DashboardShell user={ctx}>
      <EmailServiceView service={service} />
    </DashboardShell>
  );
}