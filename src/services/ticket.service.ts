import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { listClientTickets, type ClientTicket } from "@/lib/client-data";
import { notifyEvent } from "@/lib/notifications";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceResult } from "./result";

const PRIORITY_MAP: Record<string, string> = {
  low: "low",
  normal: "medium",
  medium: "medium",
  high: "high",
  critical: "urgent",
  urgent: "urgent",
};

export type TicketInput = {
  subject?: unknown;
  body?: unknown;
  category?: unknown;
  priority?: unknown;
};

export type TicketReplyInput = {
  ticketId?: unknown;
  body?: unknown;
};

export async function list(ctx: AuthContext): Promise<ServiceResult<{ tickets: ClientTicket[] }>> {
  if (!ctx.userId) {
    return fail(401, "Não autenticado.");
  }
  const tickets = await listClientTickets(ctx);
  return { ok: true, tickets };
}

export async function create(
  ctx: AuthContext,
  input: TicketInput,
  ip?: string,
): Promise<ServiceResult<{ ticket: unknown }>> {
  if (!ctx.userId) {
    return fail(401, "Não autenticado.");
  }

  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const text = typeof input.body === "string" ? input.body.trim() : "";
  if (!subject || !text) {
    return fail(400, "Assunto e mensagem são obrigatórios.");
  }

  const priority = PRIORITY_MAP[String(input.priority ?? "").toLowerCase()] ?? "medium";
  const number = `TKT-${Date.now().toString(36).toUpperCase()}`;

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .insert({
      number,
      customer_id: ctx.userId,
      subject,
      status: "open",
      priority,
      channel: "portal",
    })
    .select()
    .single();

  if (ticketError || !ticket) {
    serverLogError("service:ticket.create", ticketError ?? new Error("ticket creation returned null"));
    return fail(500, "Não foi possível criar o ticket.");
  }

  const { error: messageError } = await supabaseAdmin.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_email: ctx.email ?? "",
    body: text,
    is_internal: false,
  });
  if (messageError) {
    serverLogError("service:ticket.create", messageError);
  }

  await notifyEvent("ticket.updated", { number, subject }, { channels: ["dashboard"] });

  await logAudit({
    action: AUDIT.CLIENT_DOMAIN_UPDATED,
    entity: "ticket",
    entityId: ticket.id,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    ip,
    meta: { action: "create_ticket", subject },
  });

  return { ok: true, ticket };
}

export async function reply(
  ctx: AuthContext,
  input: TicketReplyInput,
  ip?: string,
): Promise<ServiceResult<{ ok: true }>> {
  if (!ctx.userId) {
    return fail(401, "Não autenticado.");
  }

  const ticketId = typeof input.ticketId === "string" ? input.ticketId.trim() : "";
  const text = typeof input.body === "string" ? input.body.trim() : "";
  if (!ticketId || !text) {
    return fail(400, "Ticket ID e mensagem são obrigatórios.");
  }

  const { data: existing } = await supabaseAdmin
    .from("tickets")
    .select("id, customer_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!existing || existing.customer_id !== ctx.userId) {
    return fail(404, "Ticket não encontrado.");
  }

  await supabaseAdmin.from("ticket_messages").insert({
    ticket_id: ticketId,
    author_email: ctx.email ?? "",
    body: text,
    is_internal: false,
  });

  await supabaseAdmin
    .from("tickets")
    .update({ status: "waiting", updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  await logAudit({
    action: AUDIT.CLIENT_DOMAIN_UPDATED,
    entity: "ticket",
    entityId: ticketId,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    ip,
    meta: { action: "reply_ticket" },
  });

  return { ok: true };
}