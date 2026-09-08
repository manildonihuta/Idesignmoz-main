import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
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
import { proposalActionSchema } from "@/lib/schemas";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { strongToken, proposalCode } from "@/lib/security/encryption";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";
import type { AdminContext } from "@/lib/admin";
import { fail, type ServiceResult } from "./result";

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

const KEYS: ProposalServiceKey[] = ["website", "hosting", "domain", "seo", "marketing", "maintenance"];
const SAVE_STATUSES: ProposalStatus[] = ["draft", "sent"];
const CLIENT_ACTIONS: Record<string, ProposalStatus> = {
  approve: "approved",
  reject: "rejected",
  changes: "changes_requested",
};

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

export async function listSummary(): Promise<ServiceResult<{ proposals: Proposal[] }>> {
  const { data, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    serverLogError("service:proposal.listSummary", error);
    return fail(500, "Não foi possível listar as propostas.");
  }
  return { ok: true, proposals: (data ?? []).map(mapRow) };
}

export async function saveDraft(
  body: unknown,
  ctx: AdminContext,
  ip?: string,
): Promise<ServiceResult<{ proposal: Proposal; id?: string }>> {
  const rec = (body ?? {}) as Record<string, unknown>;

  if (rec.action === "delete") {
    const id = String(rec.id ?? "");
    if (!id) return fail(400, "Identificador em falta.");
    const { error } = await supabaseAdmin.from("proposals").delete().eq("id", id);
    if (error) {
      serverLogError("service:proposal.saveDraft", error);
      return fail(500, "Não foi possível eliminar.");
    }
    await logAudit({
      action: AUDIT.PROPOSAL_DELETED,
      entity: "proposal",
      entityId: id,
      actorId: ctx.userId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      ip,
    });
    return { ok: true, proposal: undefined as unknown as Proposal, id };
  }

  const draft = await sanitizeDraft(rec.draft);
  if (!draft) {
    return fail(400, "Faltam o título e o nome do cliente.");
  }
  if (draft.lines.length === 0) {
    return fail(400, "Seleciona pelo menos um serviço.");
  }

  const status: ProposalStatus = SAVE_STATUSES.includes(rec.status as ProposalStatus)
    ? (rec.status as ProposalStatus)
    : "draft";
  const computed = computeProposal(draft);
  const id = typeof rec.id === "string" && rec.id ? rec.id : null;

  if (id) {
    const { data: existing } = await supabaseAdmin
      .from("proposals")
      .select("token, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing || !existing.token) {
      return fail(404, "Proposta não encontrada.");
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
      return fail(404, "Proposta não encontrada.");
    }
    await logAudit({
      action: AUDIT.PROPOSAL_UPDATED,
      entity: "proposal",
      entityId: id,
      actorId: ctx.userId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      ip,
      meta: { status: nextStatus },
    });
    return { ok: true, proposal: mapRow(data), id };
  }

  const token = strongToken(16);
  let data: Row | null = null;
  let lastError: { message: string; code?: string } | null = null;
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
    serverLogError("service:proposal.saveDraft", lastError ?? new Error("proposal insert failed after retries"));
    return fail(500, "Não foi possível guardar a proposta.");
  }

  await logAudit({
    action: AUDIT.PROPOSAL_CREATED,
    entity: "proposal",
    entityId: data.id ? String(data.id) : undefined,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    actorRole: ctx.role,
    ip,
    meta: { status },
  });

  return { ok: true, proposal: mapRow(data), id: data.id ? String(data.id) : undefined };
}

function genCode(): string {
  return proposalCode();
}

export async function getByToken(token: string): Promise<ServiceResult<{ proposal: Proposal }>> {
  if (!token || token.length > 100) {
    return fail(404, "Proposta não encontrada.");
  }

  const { data, error } = await supabaseAdmin.from("proposals").select("*").eq("token", token).maybeSingle();

  if (error || !data) {
    serverLogError("service:proposal.getByToken", error ?? new Error("proposal fetch returned null"));
    return fail(404, "Proposta não encontrada.");
  }

  return { ok: true, proposal: mapRow(data) };
}

export async function decide(
  token: string,
  body: unknown,
  ip?: string,
): Promise<ServiceResult<{ proposal: Proposal }>> {
  if (!token || token.length > 100) {
    return fail(404, "Proposta não encontrada.");
  }

  const parsed = proposalActionSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "Ação inválida.");
  }
  const { action, comment } = parsed.data;

  const status = CLIENT_ACTIONS[action];
  if (!status) {
    return fail(400, "Ação inválida.");
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("proposals")
    .select("id, status, code, title, client_name, total, project_id")
    .eq("token", token)
    .maybeSingle();

  if (fetchError || !existing) {
    return fail(404, "Proposta não encontrada.");
  }
  if (existing.status === "approved" || existing.status === "rejected") {
    return fail(400, "Esta proposta já foi decidida.");
  }

  const { data, error } = await supabaseAdmin
    .from("proposals")
    .update({ status, client_comment: comment })
    .eq("id", existing.id)
    .select()
    .single();

  if (error || !data) {
    serverLogError("service:proposal.decide", error ?? new Error("proposal update returned null"));
    return fail(500, "Não foi possível atualizar a proposta.");
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

    // Website journey: approving the proposal activates the linked project.
    const projectId = existing.project_id ? String(existing.project_id) : null;
    if (projectId) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("id, title, status")
        .eq("id", projectId)
        .maybeSingle();
      if (project && String(project.status ?? "") === "brief") {
        const { error: projectUpdErr } = await supabaseAdmin
          .from("projects")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", projectId);
        if (projectUpdErr) {
          serverLogError("service:proposal.decide.project", projectUpdErr);
        } else {
          await logAudit({
            action: AUDIT.PROJECT_ACTIVATED,
            entity: "project",
            entityId: projectId,
            meta: { proposalCode: existing.code, source: "proposal.approval" },
          });
          await notifyEvent(
            "project.activated",
            { title: String(project.title ?? "") },
            {},
          );
        }
      }
    }
  }

  return { ok: true, proposal: mapRow(data) };
}