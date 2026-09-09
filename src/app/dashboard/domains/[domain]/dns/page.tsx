import { redirect } from "next/navigation";

import { getClientContext } from "@/lib/client";
import { dnsGetBundle } from "@/services/dns.service";
import DnsRecordsView from "@/components/dns/dns-records-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DNS Management · IDesign Moz",
};

export default async function ManageDomainDnsPage({ params }: { params: Promise<{ domain: string }> }) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { domain } = await params;
  const result = await dnsGetBundle(ctx, domain);
  if (!result.ok) redirect("/dashboard/domains");

  return <DnsRecordsView fullDomain={domain} initialBundle={result.bundle} />;
}