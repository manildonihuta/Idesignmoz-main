import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { getProjects, invalidateContentCache } from "@/lib/content";
import { PROJECTS as DEFAULT_PROJECTS, type Project } from "@/lib/portfolio";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/security/audit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

/** Staff-only (settings.manage). Returns all portfolio projects. */
export async function GET() {
  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  try {
    const projects = await getProjects();
    const result = projects && projects.length > 0 ? projects : DEFAULT_PROJECTS;
    return Response.json({ ok: true, projects: result });
  } catch (e) {
    serverLogError("api:admin/portfolio:GET", e);
    return Response.json(
      { ok: false, error: "Não foi possível carregar os trabalhos." },
      { status: 500 },
    );
  }
}

/** Staff-only (settings.manage). Persists portfolio projects list. */
export async function PUT(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "admin-portfolio",
    limit: 60,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const guard = await requirePermissionRoute("settings.manage");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:admin/portfolio:PUT", e);
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const projectsRaw = (body && typeof body === "object" && "projects" in body)
    ? (body as { projects: unknown }).projects
    : body;

  if (!Array.isArray(projectsRaw)) {
    return Response.json(
      { ok: false, error: "A lista de trabalhos deve ser um array." },
      { status: 400 },
    );
  }

  const projects: Project[] = [];
  for (const item of projectsRaw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const slug = String(p.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const client = String(p.client || "").trim();
    if (!client) continue;

    projects.push({
      slug: slug || `projeto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      client,
      industry: String(p.industry || "Tecnologia").trim(),
      year: String(p.year || new Date().getFullYear()).trim(),
      categories: Array.isArray(p.categories) ? (p.categories as any[]) : ["Websites"],
      services: Array.isArray(p.services)
        ? (p.services as string[]).map((s) => String(s).trim()).filter(Boolean)
        : typeof p.services === "string"
        ? (p.services as string).split("/").map((s) => s.trim()).filter(Boolean)
        : ["Website"],
      image: String(p.image || "").trim(),
      summary: String(p.summary || "").trim(),
      challenge: String(p.challenge || "").trim(),
      strategy: String(p.strategy || "").trim(),
      design: String(p.design || "").trim(),
      development: String(p.development || "").trim(),
      technology: Array.isArray(p.technology)
        ? (p.technology as string[]).map((t) => String(t).trim()).filter(Boolean)
        : ["Next.js", "React"],
      results: Array.isArray(p.results)
        ? (p.results as Array<{ metric: string; label: string }>)
        : [],
      url: p.url ? String(p.url).trim() : undefined,
    });
  }

  try {
    const { error } = await supabaseAdmin.from("site_settings").upsert(
      {
        key: "portfolio_projects",
        value: projects,
        updated_by: guard.ctx.userId ?? null,
      },
      { onConflict: "key" },
    );

    if (error) throw new Error(error.message);

    invalidateContentCache();

    await logAudit({
      action: "SETTINGS_UPDATED",
      entity: "portfolio",
      actorId: guard.ctx.userId ?? undefined,
      ip,
      meta: { section: "portfolio_projects", count: projects.length },
    });

    return Response.json({ ok: true, projects });
  } catch (e) {
    serverLogError("api:admin/portfolio:PUT", e);
    return Response.json(
      { ok: false, error: "Não foi possível guardar os trabalhos." },
      { status: 500 },
    );
  }
}
