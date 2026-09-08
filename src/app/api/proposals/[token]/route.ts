import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Proposal, ProposalStatus } from "@/lib/proposals";
import { proposalActionSchema } from "@/lib/schemas";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";

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

const CLIENT_ACTIONS: Record<string, ProposalStatus> = {
  approve: "approved",
  reject: "rejected",
  changes: "changes_requested",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 100) {
    return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
  }

  const limited = await applyRateLimit(request, {
    prefix: `proposal:${token.slice(0, 16)}`,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { data, error } = await supabaseAdmin.from("proposals").select("*").eq("token", token).maybeSingle();

  if (error || !data) {
    serverLogError("api:proposals/[token]", error ?? new Error("proposal fetch returned null"));
    return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
  }

  return Response.json({ ok: true, proposal: mapRow(data) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 100) {
    return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
  }

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: `proposal-action:${token.slice(0, 16)}`,
    limit: 5,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:proposals/[token]", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = proposalActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  }
  const { action, comment } = parsed.data;

  const status = CLIENT_ACTIONS[action];
  if (!status) {
    return Response.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("proposals")
    .select("id, status, code, title, client_name, total")
    .eq("token", token)
    .maybeSingle();

  if (fetchError || !existing) {
    return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
  }
  if (existing.status === "approved" || existing.status === "rejected") {
    return Response.json({ ok: false, error: "Esta proposta já foi decidida." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("proposals")
    .update({ status, client_comment: comment })
    .eq("id", existing.id)
    .select()
    .single();

  if (error || !data) {
    serverLogError("api:proposals/[token]", error ?? new Error("proposal update returned null"));
    return Response.json({ ok: false, error: "Não foi possível atualizar a proposta." }, { status: 500 });
  }

  await logAudit({
    action: AUDIT.PROPOSAL_CLIENT_DECISION,
    entity: "proposal",
    entityId: existing.id,
    ip,
    meta: { action, status },
  });

  if (status === "approved") {
    await notifyEvent(
      "proposal.approved",
      { code: existing.code, title: existing.title, clientName: existing.client_name, total: existing.total },
      {},
    );
  }

  return Response.json({ ok: true, proposal: mapRow(data) });
}