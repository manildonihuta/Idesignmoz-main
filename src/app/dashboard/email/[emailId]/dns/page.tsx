import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmailDnsView } from "@/components/email-dns-view";
import { getClientContext } from "@/lib/client";
import { getClientEmailDns } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configuração DNS — Email — Área de cliente",
};

export default async function DashboardEmailDnsPage({
  params,
}: {
  params: Promise<{ emailId: string }>;
}) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { emailId } = await params;
  const bundle = await getClientEmailDns(ctx, emailId);
  if (!bundle) redirect("/dashboard/email");

  return (
    <DashboardShell user={ctx}>
      <EmailDnsView initial={bundle} />
    </DashboardShell>
  );
}