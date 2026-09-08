import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";
import { listClientProjects, type ClientProject } from "@/lib/client-data";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceResult } from "./result";

export async function listClient(ctx: AuthContext): Promise<ClientProject[]> {
  return listClientProjects(ctx);
}

export type ClientProjectActionInput = {
  projectId?: string;
  action?: string;
  body?: string;
  status?: string;
};

export async function clientAction(
  ctx: AuthContext,
  input: ClientProjectActionInput,
  ip?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const projectId = input.projectId?.trim();
  if (!projectId) {
    return fail(400, "ID do projeto obrigatório.");
  }

  const { data: existing } = await supabaseAdmin
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!existing || existing.client_id !== ctx.userId) {
    return fail(404, "Projeto não encontrado.");
  }

  if (input.action === "comment" && input.body?.trim()) {
    await supabaseAdmin.from("project_comments").insert({
      project_id: projectId,
      body: `Cliente: ${input.body.trim()}`,
    });

    await logAudit({
      action: AUDIT.CLIENT_DOMAIN_UPDATED,
      entity: "project",
      entityId: projectId,
      actorId: ctx.userId,
      actorEmail: ctx.email,
      ip,
      meta: { action: "add_comment" },
    });

    return { ok: true };
  }

  if (input.action === "update_status" && input.status) {
    const validStatuses = ["draft", "published", "archived"];
    const newStatus = validStatuses.includes(input.status) ? input.status : "draft";
    await supabaseAdmin
      .from("projects")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    await logAudit({
      action: AUDIT.CLIENT_DOMAIN_UPDATED,
      entity: "project",
      entityId: projectId,
      actorId: ctx.userId,
      actorEmail: ctx.email,
      ip,
      meta: { action: "update_status", status: newStatus },
    });

    return { ok: true };
  }

  return fail(400, "Ação inválida.");
}

export async function listAdmin(): Promise<unknown[]> {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data) {
    serverLogError("service:project.listAdmin", new Error("projects query returned null"));
    return [];
  }
  return data;
}