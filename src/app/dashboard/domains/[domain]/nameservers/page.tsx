import { redirect } from "next/navigation";

import { getClientContext } from "@/lib/client";
import { dnsGetBundle } from "@/services/dns.service";
import DnsNameserversView from "@/components/dns/dns-nameservers-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nameservers · IDesign Moz",
};

export default async function ManageDomainNameserversPage({ params }: { params: Promise<{ domain: string }> }) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { domain } = await params;
  const result = await dnsGetBundle(ctx, domain);
  if (!result.ok) redirect("/dashboard/domains");

  return <DnsNameserversView fullDomain={domain} initialBundle={result.bundle} />;
}