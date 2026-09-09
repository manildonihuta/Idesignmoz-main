import { redirect } from "next/navigation";

import { getClientContext } from "@/lib/client";
import { dnsGetBundle } from "@/services/dns.service";
import DnsSecurityView from "@/components/dns/dns-security-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security DNS · IDesign Moz",
};

export default async function ManageDomainSecurityPage({ params }: { params: Promise<{ domain: string }> }) {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const { domain } = await params;
  const result = await dnsGetBundle(ctx, domain);
  if (!result.ok) redirect("/dashboard/domains");

  return <DnsSecurityView fullDomain={domain} initialBundle={result.bundle} />;
}