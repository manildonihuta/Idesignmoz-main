import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactSchema, messageStatusSchema, profileRoleSchema, uuidSchema } from "@/lib/schemas";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";
import { listClientTickets, type ClientTicket } from "@/lib/client-data";
import { normalizeRole, ROLE_LABEL } from "@/lib/security/rbac";
import type { AdminContext } from "@/lib/admin";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceResult } from "./result";
import type { Actor } from "./domain.service";

/* --------------------------------------------------------------------- *
 * Contact form (public) + admin message management
 * --------------------------------------------------------------------- */

export async function submitContact(
  input: unknown,
  ip?: string,
): Promise<ServiceResult<{ message: unknown }>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return fail(400, parsed.error.issues[0]?.message ?? "Campos inválidos.");
  }

  const { name, email, service, message } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .insert({ name, email, service, message })
    .select()
    .single();

  if (error) {
    serverLogError("service:crm.submitContact", error);
    return fail(500, "Não foi possível enviar o pedido.");
  }

  await logAudit({
    action: AUDIT.CONTACT_CREATED,
    entity: "contact_message",
    entityId: data?.id,
    actorEmail: email,
    ip,
    meta: { service },
  });

  return { ok: true, message: data };
}

export async function setMessageStatus(
  id: string,
  status: string,
  actor: Actor,
  ip?: string,
): Promise<ServiceResult<{ message: unknown }>> {
  const parsed = messageStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return fail(400, "Dados inválidos.");
  }

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return fail(404, "Mensagem não encontrada.");
  }

  await logAudit({
    action: AUDIT.MESSAGE_STATUS,
    entity: "contact_message",
    entityId: id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { status },
  });

  return { ok: true, message: data };
}

export async function deleteMessage(id: string, actor: Actor, ip?: string): Promise<ServiceResult<{ id: string }>> {
  if (!uuidSchema.safeParse(id).success) {
    return fail(400, "Identificador inválido.");
  }

  const { error } = await supabaseAdmin.from("contact_messages").delete().eq("id", id);
  if (error) {
    serverLogError("service:crm.deleteMessage", error);
    return fail(500, "Não foi possível eliminar.");
  }

  await logAudit({
    action: AUDIT.MESSAGE_DELETED,
    entity: "contact_message",
    entityId: id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
  });

  return { ok: true, id };
}

/* --------------------------------------------------------------------- *
 * Admin profiles (role management)
 * --------------------------------------------------------------------- */

export async function updateProfileRole(
  id: string,
  role: string,
  actor: AdminContext,
  ip?: string,
): Promise<ServiceResult<{ profile: unknown }>> {
  const parsed = profileRoleSchema.safeParse({ id, role });
  if (!parsed.success) {
    return fail(400, "Função inválida.");
  }

  const normalizedRole = normalizeRole(parsed.data.role);

  // Only super admins may grant or revoke super_admin.
  if (normalizedRole === "super_admin" && actor.role !== "super_admin") {
    return fail(403, "Apenas um Super Admin pode atribuir este acesso.");
  }

  // Never allow an admin to demote themselves — it would lock the panel.
  if (id === actor.userId && normalizedRole !== "super_admin" && normalizedRole !== actor.role) {
    return fail(403, "Não podes remover o teu próprio acesso administrativo.");
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role: normalizedRole })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return fail(404, "Utilizador não encontrado.");
  }

  await logAudit({
    action: AUDIT.PROFILE_ROLE,
    entity: "profile",
    entityId: id,
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    meta: { role: normalizedRole, label: ROLE_LABEL[normalizedRole] },
  });

  return { ok: true, profile: data };
}

/* --------------------------------------------------------------------- *
 * Support tickets — client access
 * --------------------------------------------------------------------- */

export async function listClientTicketsService(ctx: AuthContext): Promise<ClientTicket[]> {
  return listClientTickets(ctx);
}

const PRIORITY_MAP: Record<string, string> = {
  low: "low",
  normal: "medium",
  medium: "medium",
  high: "high",
  critical: "urgent",
  urgent: "urgent",
};

export async function createClientTicket(
  ctx: AuthContext,
  input: { subject?: string; body?: string; category?: string; priority?: string },
  ip?: string,
): Promise<ServiceResult<{ ticket: unknown }>> {
  const subject = input.subject?.trim();
  const text = input.body?.trim();
  if (!subject || !text) {
    return fail(400, "Assunto e mensagem são obrigatórios.");
  }

  const number = `TKT-${Date.now().toString(36).toUpperCase()}`;
  const priority = PRIORITY_MAP[(input.priority ?? "").toLowerCase()] ?? "medium";

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
    serverLogError("service:crm.createClientTicket", ticketError ?? new Error("ticket creation returned null"));
    return fail(500, "Não foi possível criar o ticket.");
  }

  await supabaseAdmin.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_email: ctx.email,
    body: text,
    is_internal: false,
  });

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

export async function replyClientTicket(
  ctx: AuthContext,
  input: { ticketId?: string; body?: string },
  ip?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const ticketId = input.ticketId?.trim();
  const text = input.body?.trim();
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
    author_email: ctx.email,
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

/* --------------------------------------------------------------------- *
 * Support tickets — staff (all customers)
 * --------------------------------------------------------------------- */

export async function listAdminTickets(): Promise<ClientTicket[]> {
  const { data: tickets } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!tickets?.length) return [];

  const ticketIds = tickets.map((t) => t.id);
  const { data: allMessages } = await supabaseAdmin
    .from("ticket_messages")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: true });

  const msgsByTicket = new Map<string, NonNullable<typeof allMessages>[number][]>();
  for (const msg of allMessages ?? []) {
    const key = String(msg.ticket_id);
    const list = msgsByTicket.get(key) ?? [];
    list.push(msg);
    msgsByTicket.set(key, list);
  }

  return tickets.map((t) => ({
    id: t.id,
    number: t.number,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    category: t.channel,
    channel: t.channel,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    messages: (msgsByTicket.get(String(t.id)) ?? []).map((m) => ({
      id: m.id,
      authorEmail: m.author_email,
      body: m.body,
      isInternal: m.is_internal,
      createdAt: m.created_at,
    })),
  }));
}