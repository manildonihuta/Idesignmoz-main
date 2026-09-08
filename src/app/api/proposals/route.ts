import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requirePermissionRoute } from "@/lib/admin";
import { getProposalCatalog } from "@/lib/content";
import {
  catalogFor,
  computeProposal,
  type Proposal,
  type ProposalDraft,
  type ProposalLine,
  type ProposalServiceKey,
  type ProposalStatus,
} from "@/lib/proposals";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { strongToken, proposalCode } from "@/lib/security/encryption";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const KEYS: ProposalServiceKey[] = ["website", "hosting", "domain", "seo", "marketing", "maintenance"];
const SAVE_STATUSES: ProposalStatus[] = ["draft", "sent"];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function sanitizeLines(input: unknown): Promise<ProposalLine[]> {
  if (!Array.isArray(input)) return [];
  const catalog = await getProposalCatalog();
  const seen = new Set<string>();
  const out: ProposalLine[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (!KEYS.includes(rec.key as ProposalServiceKey) || seen.has(rec.key as string)) continue;
    const key = rec.key as ProposalServiceKey;
    seen.add(key);
    const cat = catalogFor(key, catalog);
    out.push({
      key,
      label: typeof rec.label === "string" && rec.label.trim() ? rec.label.slice(0, 80) : cat.label,
      detail: typeof rec.detail === "string" ? rec.detail.slice(0, 200) : cat.detail,
      qty: clampInt(rec.qty, 1, 999, 1),
      unitPrice: clampInt(rec.unitPrice, 0, 10_000_000, 0),
    });
  }
  return out;
}

async function sanitizeDraft(raw: unknown): Promise<ProposalDraft | null> {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const title = typeof rec.title === "string" ? rec.title.trim().slice(0, 160) : "";
  const clientName = typeof rec.clientName === "string" ? rec.clientName.trim().slice(0, 160) : "";
  if (!title || !clientName) return null;
  return {
    title,
    clientName,
    clientEmail: typeof rec.clientEmail === "string" ? rec.clientEmail.trim().slice(0, 160) : "",
    clientCompany: typeof rec.clientCompany === "string" ? rec.clientCompany.trim().slice(0, 160) : "",
    lines: await sanitizeLines(rec.lines),
    discountPercent: clampInt(rec.discountPercent, 0, 100, 0),
    taxRate: clampInt(rec.taxRate, 0, 100, 15),
    validityDays: clampInt(rec.validityDays, 1, 365, 30),
    notes: typeof rec.notes === "string" ? rec.notes.slice(0, 2000) : "",
  };
}

type Row = Record<string, unknown>;

function mapRow(row: Row): Proposal {
  return {
    id: String(row.id),
    code: String(row.code),
    token: String(row.token),
    title: String(row.title ?? ""),
    clientName: String(row.client_name ?? ""),
    clientEmail: String(row.client_email ?? ""),
    clientCompany: String(row.client_company ?? ""),
    lines: Array.isArray(row.services) ? (row.services as ProposalLine[]) : [],
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

function genCode(): string {
  return proposalCode();
}

function toRow(draft: ProposalDraft, computed: ReturnType<typeof computeProposal>, status: ProposalStatus, token: string) {
  return {
    token,
    title: draft.title,
    client_name: draft.clientName,
    client_email: draft.clientEmail,
    client_company: draft.clientCompany,
    services: draft.lines,
    subtotal: computed.subtotal,
    discount_percent: computed.discountPercent,
    discount_amount: computed.discountAmount,
    tax_rate: computed.taxRate,
    tax_amount: computed.taxAmount,
    total: computed.total,
    validity_days: draft.validityDays,
    notes: draft.notes,
    status,
  };
}

export async function GET() {
  const guard = await requirePermissionRoute("proposals.view");
  if (guard.response) return guard.response;

  const { data, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    serverLogError("api:proposals", error);
    return Response.json({ ok: false, error: "Não foi possível listar as propostas." }, { status: 500 });
  }

  return Response.json({ ok: true, proposals: (data ?? []).map(mapRow) });
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("proposals.manage");
  if (guard.response) return guard.response;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "proposals",
    limit: 30,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:proposals", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  if (body.action === "delete") {
    const id = String(body.id ?? "");
    if (!id) return Response.json({ ok: false, error: "Identificador em falta." }, { status: 400 });
    const { error } = await supabaseAdmin.from("proposals").delete().eq("id", id);
    if (error) {
      serverLogError("api:proposals", error);
      return Response.json({ ok: false, error: "Não foi possível eliminar." }, { status: 500 });
    }
    await logAudit({
      action: AUDIT.PROPOSAL_DELETED,
      entity: "proposal",
      entityId: id,
      actorId: guard.ctx.userId,
      actorEmail: guard.ctx.email,
      actorRole: guard.ctx.role,
      ip,
    });
    return Response.json({ ok: true, id });
  }

  const draft = await sanitizeDraft(body.draft);
  if (!draft) {
    return Response.json({ ok: false, error: "Faltam o título e o nome do cliente." }, { status: 400 });
  }
  if (draft.lines.length === 0) {
    return Response.json({ ok: false, error: "Seleciona pelo menos um serviço." }, { status: 400 });
  }

  const status: ProposalStatus = SAVE_STATUSES.includes(body.status as ProposalStatus)
    ? (body.status as ProposalStatus)
    : "draft";
  const computed = computeProposal(draft);
  const id = typeof body.id === "string" && body.id ? body.id : null;

  if (id) {
    const { data: existing } = await supabaseAdmin
      .from("proposals")
      .select("token, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing || !existing.token) {
      return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
    }
    const terminal = existing.status === "approved" || existing.status === "rejected";
    const nextStatus: ProposalStatus = terminal ? existing.status : status;
    const { data, error } = await supabaseAdmin
      .from("proposals")
      .update(toRow(draft, computed, nextStatus, String(existing.token)))
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return Response.json({ ok: false, error: "Proposta não encontrada." }, { status: 404 });
    }
    await logAudit({
      action: AUDIT.PROPOSAL_UPDATED,
      entity: "proposal",
      entityId: id,
      actorId: guard.ctx.userId,
      actorEmail: guard.ctx.email,
      actorRole: guard.ctx.role,
      ip,
      meta: { status: nextStatus },
    });
    return Response.json({ ok: true, proposal: mapRow(data) });
  }

  const token = strongToken(16);
  let data: Row | null = null;
  let lastError: { message: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await supabaseAdmin
      .from("proposals")
      .insert({ ...toRow(draft, computed, status, token), code: genCode() })
      .select()
      .single();
    if (error) {
      lastError = error;
      if (String(error.code) !== "23505") break;
      continue;
    }
    data = row;
    break;
  }

  if (!data) {
    serverLogError("api:proposals", lastError ?? new Error("proposal insert failed after retries"));
    return Response.json(
      { ok: false, error: lastError?.message ? "Não foi possível guardar a proposta." : "Não foi possível guardar a proposta." },
      { status: 500 },
    );
  }

  await logAudit({
    action: AUDIT.PROPOSAL_CREATED,
    entity: "proposal",
    entityId: data.id ? String(data.id) : undefined,
    actorId: guard.ctx.userId,
    actorEmail: guard.ctx.email,
    actorRole: guard.ctx.role,
    ip,
    meta: { status },
  });

  return Response.json({ ok: true, proposal: mapRow(data) });
}