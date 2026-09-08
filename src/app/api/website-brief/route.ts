import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { strongToken, proposalCode } from "@/lib/security/encryption";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { computeProposal, type ProposalDraft } from "@/lib/proposals";
import { serverLogError } from "@/lib/server-log";
import { getWebsitePackage } from "@/lib/website-packages";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function timelineDeadline(timeline: string): string {
  const weeks = timeline === "3+ months" ? 12 : timeline === "1-2 months" ? 6 : 3;
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Public onboarding endpoint for the website journey:
 *  Brief → project (brief) + proposal (sent, linked) → client approves online. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { prefix: "website-brief", limit: 8, windowSec: 300, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: { packageSlug?: unknown; name?: unknown; email?: unknown; phone?: unknown; company?: unknown; message?: unknown; timeline?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const packageSlug = typeof body.packageSlug === "string" ? body.packageSlug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 160) : "";
  const company = typeof body.company === "string" ? body.company.trim().slice(0, 160) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const timeline = typeof body.timeline === "string" ? body.timeline : "2-4 weeks";

  if (!packageSlug || !name || !EMAIL_RE.test(email) || !message) {
    return Response.json({ ok: false, error: "Preencha o nome, um email válido, o pacote e a descrição do projeto." }, { status: 400 });
  }

  const pkg = await getWebsitePackage(packageSlug);
  if (!pkg) {
    return Response.json({ ok: false, error: "Pacote não encontrado." }, { status: 404 });
  }

  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  const clientId = user?.id ?? null;

  // Proposal totals derive from the DB package (base + discount) + default tax.
  const discountPercent =
    pkg.basePrice > 0 && pkg.price < pkg.basePrice
      ? Math.round(((pkg.basePrice - pkg.price) / pkg.basePrice) * 100)
      : 0;
  const draft: ProposalDraft = {
    title: company || name,
    clientName: name,
    clientEmail: email,
    clientCompany: company,
    lines: [
      {
        key: "website",
        label: pkg.name,
        detail: pkg.description ?? "",
        qty: 1,
        unitPrice: pkg.price,
      },
    ],
    discountPercent,
    taxRate: 15,
    validityDays: 30,
    notes: message,
  };
  const computed = computeProposal(draft);

  const projectTitle = company ? `${pkg.name} — ${company}` : `${pkg.name} — ${name}`;
  const { data: project, error: projectErr } = await supabaseAdmin
    .from("projects")
    .insert({
      client_id: clientId,
      title: projectTitle.slice(0, 200),
      description: message.slice(0, 2000),
      category: "Website",
      status: "brief",
      budget: pkg.price,
      start_date: new Date().toISOString().slice(0, 10),
      deadline: timelineDeadline(timeline),
    })
    .select("id")
    .single();
  if (projectErr || !project) {
    serverLogError("api:website-brief.project", projectErr ?? new Error("project insert failed"));
    return Response.json({ ok: false, error: "Não foi possível criar o projeto." }, { status: 500 });
  }

  const token = strongToken(16);
  const { data: proposal, error: proposalErr } = await supabaseAdmin
    .from("proposals")
    .insert({
      code: proposalCode(),
      token,
      title: (company || name).slice(0, 160),
      client_name: name,
      client_email: email,
      client_company: company,
      services: draft.lines,
      subtotal: computed.subtotal,
      discount_percent: computed.discountPercent,
      discount_amount: computed.discountAmount,
      tax_rate: computed.taxRate,
      tax_amount: computed.taxAmount,
      total: computed.total,
      validity_days: 30,
      notes: message.slice(0, 2000),
      status: "sent",
      project_id: project.id,
    })
    .select("id")
    .single();
  if (proposalErr || !proposal) {
    serverLogError("api:website-brief.proposal", proposalErr ?? new Error("proposal insert failed"));
    await supabaseAdmin.from("projects").delete().eq("id", project.id);
    return Response.json({ ok: false, error: "Não foi possível criar a proposta." }, { status: 500 });
  }

  await logAudit({
    action: AUDIT.PROPOSAL_CREATED,
    entity: "proposal",
    entityId: proposal.id,
    actorId: clientId ?? undefined,
    meta: { source: "website-brief", package: pkg.slug, total: computed.total },
  });
  await logAudit({
    action: AUDIT.PROJECT_BRIEF,
    entity: "project",
    entityId: project.id,
    actorId: clientId ?? undefined,
    meta: { package: pkg.slug, proposalId: proposal.id, phone },
  });

  await notifyEvent("website.brief", {
    package: pkg.name,
    clientName: name,
    company,
    total: computed.total,
  });

  return Response.json({ ok: true, proposalToken: token, projectId: project.id, proposalId: proposal.id }, { status: 200 });
}