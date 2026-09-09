import { redirect } from "next/navigation";

import { getClientContext } from "@/lib/client";
import { dnsGetBundle } from "@/services/dns.service";
import DnsOverviewView from "@/components/dns/dns-overview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview DNS · IDesign Moz",
};

export default async function ManageDomainOverviewPage({ params }: { params: Promise<{ domain: string }> }) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { domain } = await params;
  const result = await dnsGetBundle(ctx, domain);
  if (!result.ok) redirect("/dashboard/domains");

  return <DnsOverviewView fullDomain={domain} initialBundle={result.bundle} />;
}