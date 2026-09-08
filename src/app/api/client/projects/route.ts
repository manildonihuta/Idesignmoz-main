import { NextRequest } from "next/server";
import { requireClientRoute } from "@/lib/client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "client-projects",
    limit: 20,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: { projectId?: string; action?: string; body?: string; status?: string };
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:client/projects", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return Response.json({ ok: false, error: "ID do projeto obrigatório." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!existing || existing.client_id !== ctx.userId) {
    return Response.json({ ok: false, error: "Projeto não encontrado." }, { status: 404 });
  }

  if (body.action === "comment" && body.body?.trim()) {
    await supabaseAdmin.from("project_comments").insert({
      project_id: projectId,
      body: `Cliente: ${body.body.trim()}`,
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

    return Response.json({ ok: true });
  }

  if (body.action === "update_status" && body.status) {
    const validStatuses = ["draft", "published", "archived"];
    const newStatus = validStatuses.includes(body.status) ? body.status : "draft";
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

    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Ação inválida." }, { status: 400 });
}
