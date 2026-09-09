import { redirect } from "next/navigation";

import { getClientContext } from "@/lib/client";
import { dnsGetBundle } from "@/services/dns.service";
import DnsActivityView from "@/components/dns/dns-activity-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity DNS · IDesign Moz",
};

export default async function ManageDomainActivityPage({ params }: { params: Promise<{ domain: string }> }) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { domain } = await params;
  const result = await dnsGetBundle(ctx, domain);
  if (!result.ok) redirect("/dashboard/domains");

  return <DnsActivityView fullDomain={domain} initialBundle={result.bundle} />;
}