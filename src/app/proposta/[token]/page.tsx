import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ProposalReview } from "@/components/proposal-review";
import type { Proposal, ProposalStatus } from "@/lib/proposals";
import { getCompanyInfo } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>): Proposal {
  return {
    id: String(row.id),
    code: String(row.code),
    token: String(row.token),
    title: String(row.title ?? ""),
    clientName: String(row.client_name ?? ""),
    clientEmail: String(row.client_email ?? ""),
    clientCompany: String(row.client_company ?? ""),
    lines: Array.isArray(row.services) ? (row.services as Proposal["lines"]) : [],
    subtotal: Number(row.subtotal ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    taxRate: Number(row.tax_rate ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    total: Number(row.total ?? 0),
    validityDays: Number(row.validity_days ?? 30),
    notes: String(row.notes ?? ""),
    status: String(row.status ?? "draft") as ProposalStatus,
    clientComment: String(row.client_comment ?? ""),
    createdAt: new Date(String(row.created_at ?? Date.now())).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? Date.now())).toISOString(),
  };
}

async function fetchProposal(token: string): Promise<Proposal | null> {
  if (!token || token.length > 100) return null;
  const { data, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const proposal = await fetchProposal(token);
  return {
    title: proposal ? `${proposal.title} — Proposta IDesign Moz` : "Proposta — IDesign Moz",
    description: proposal ? `Proposta comercial ${proposal.code} para ${proposal.clientName}.` : undefined,
  };
}

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await fetchProposal(token);
  if (!proposal) notFound();
  const company = await getCompanyInfo();

  return (
    <main id="main">
      <ProposalReview proposal={proposal} company={company} />
    </main>
  );
}