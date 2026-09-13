import { redirect } from "next/navigation";

import { getClientContext } from "@/lib/client";
import { getHostingOverview } from "@/services/hosting-panel.service";
import HostingOverviewView from "@/components/hosting/hosting-overview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview · Alojamento · IDesign Moz",
};

export default async function HostingOverviewPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { hostingId } = await params;
  const result = await getHostingOverview(ctx, hostingId);
  if (!result.ok) redirect("/dashboard/hosting");

  return <HostingOverviewView hostingId={hostingId} initial={result.overview} />;
}