import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceResult } from "@/services/result";
import { isAiConfigured, chatJson, AiError } from "@/lib/ai/provider";
import { buildSitePrompt, buildRewriteSectionPrompt } from "@/lib/ai/builder-prompt";
import {
  parseSitePayload,
  parseSectionPayload,
  parseSectionsInput,
  type Theme,
  type SitePayload,
  type ParsedSection,
} from "@/lib/ai/builder-schema";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";

export type BuilderSiteStatus = "draft" | "generating" | "ready" | "failed" | "published" | "archived";

type BuilderSiteRow = {
  id: string;
  project_id: string | null;
  business_name: string;
  domain: string | null;
  industry: string | null;
  tagline: string;
  brief: string;
  theme: Record<string, unknown> | null;
  seo: Record<string, unknown> | null;
  status: BuilderSiteStatus;
  error: string | null;
  generated_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BuilderSite = {
  id: string;
  projectId: string | null;
  businessName: string;
  domain: string | null;
  industry: string | null;
  tagline: string;
  brief: string;
  theme: Theme;
  seo: { title: string; description: string } | null;
  status: BuilderSiteStatus;
  error: string | null;
  generatedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pages?: BuilderPage[];
};

export type BuilderPage = {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  navLabel: string | null;
  sort: number;
  sections: ParsedSection[];
  updatedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toTheme(value: unknown): Theme {
  const raw = asRecord(value);
  const theme: Theme = {};
  if (typeof raw.primaryColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.primaryColor)) theme.primaryColor = raw.primaryColor;
  if (typeof raw.accentColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.accentColor)) theme.accentColor = raw.accentColor;
  if (raw.mode === "dark" || raw.mode === "light") theme.mode = raw.mode;
  if (raw.font === "sans" || raw.font === "display" || raw.font === "mono") theme.font = raw.font;
  return theme;
}

function toSeo(value: unknown): BuilderSite["seo"] {
  const raw = asRecord(value);
  if (typeof raw.title !== "string" || !raw.title) return null;
  return {
    title: raw.title.slice(0, 120),
    description: typeof raw.description === "string" ? raw.description.slice(0, 300) : "",
  };
}

function toSite(row: BuilderSiteRow): BuilderSite {
  return {
    id: row.id,
    projectId: row.project_id,
    businessName: row.business_name,
    domain: row.domain,
    industry: row.industry,
    tagline: row.tagline,
    brief: row.brief,
    theme: toTheme(row.theme),
    seo: toSeo(row.seo),
    status: row.status,
    error: row.error,
    generatedAt: row.generated_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ownerSite(siteId: string, userId: string): Promise<{ row: BuilderSiteRow; theme: Record<string, unknown> } | null> {
  const { data } = await supabaseAdmin
    .from("builder_sites")
    .select("*")
    .eq("id", siteId)
    .eq("client_id", userId)
    .single();
  if (!data) return null;
  return { row: data as BuilderSiteRow, theme: asRecord(data.theme) };
}

async function fetchPages(siteId: string): Promise<BuilderPage[]> {
  const { data } = await supabaseAdmin
    .from("builder_pages")
    .select("*")
    .eq("site_id", siteId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id,
    siteId: p.site_id,
    slug: p.slug,
    title: p.title,
    navLabel: p.nav_label,
    sort: p.sort,
    sections: (p.sections ?? []) as ParsedSection[],
    updatedAt: p.updated_at,
  }));
}

async function markFailed(siteId: string, err: unknown): Promise<void> {
  const message = err instanceof AiError ? err.message : "Falha de geração.";
  await supabaseAdmin
    .from("builder_sites")
    .update({ status: "failed", error: message.slice(0, 500) })
    .eq("id", siteId);
}

export async function listSites(ctx: AuthContext): Promise<ServiceResult<{ sites: BuilderSite[] }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");
  const { data, error } = await supabaseAdmin
    .from("builder_sites")
    .select("*")
    .eq("client_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    serverLogError("ai-builder:list", error);
    return fail(500, "Não foi possível listar os sites.");
  }
  return { ok: true, sites: (data ?? []).map((r) => toSite(r as BuilderSiteRow)) };
}

export async function getSite(ctx: AuthContext, siteId: string): Promise<ServiceResult<{ site: BuilderSite }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");
  const owned = await ownerSite(siteId, ctx.userId);
  if (!owned) return fail(404, "Site não encontrado.");
  const [site, pages] = [toSite(owned.row), await fetchPages(siteId)];
  return { ok: true, site: { ...site, pages } };
}

export type GenerateSiteInput = {
  siteId?: string;
  businessName: string;
  industry?: string;
  domain?: string;
  tagline?: string;
  brief: string;
  primaryColor?: string;
};

export async function generateSite(ctx: AuthContext, input: GenerateSiteInput): Promise<ServiceResult<{ siteId: string; pages: number }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");

  const businessName = input.businessName.trim().slice(0, 160);
  const brief = input.brief.trim().slice(0, 4000);
  const domain = input.domain?.trim().slice(0, 200) || null;
  const industry = input.industry?.trim().slice(0, 120) || null;
  const tagline = input.tagline?.trim().slice(0, 300) || "";
  const primaryColor = input.primaryColor?.trim().match(/^#[0-9a-fA-F]{3,8}$/)?.[0];

  if (!businessName) return fail(400, "Indique o nome do negócio.");
  if (brief.length < 20) return fail(400, "Descreva o seu negócio em pelo menos 20 caracteres.");
  if (!isAiConfigured()) return fail(503, "A geração por IA ainda não está configurada. Contacte o apoio.");

  let siteId = input.siteId ?? undefined;
  let existingTheme: Record<string, unknown> = {};

  if (siteId) {
    const owned = await ownerSite(siteId, ctx.userId);
    if (!owned) return fail(404, "Site não encontrado.");
    existingTheme = owned.theme;
    await supabaseAdmin
      .from("builder_sites")
      .update({
        business_name: businessName,
        industry,
        domain,
        tagline,
        brief,
        status: "generating",
        error: null,
        project_id: owned.row.project_id,
      })
      .eq("id", siteId);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("builder_sites")
      .insert({
        client_id: ctx.userId,
        business_name: businessName,
        industry,
        domain,
        tagline,
        brief,
        theme: primaryColor ? { primaryColor } : {},
        status: "generating",
      })
      .select("id")
      .single();
    if (!created || error) {
      serverLogError("ai-builder:create-site", error ?? new Error("insert failed"));
      return fail(500, "Não foi possível criar o site.");
    }
    siteId = created.id;
  }

  if (!siteId) return fail(500, "Não foi possível criar o site.");

  let payload: SitePayload;
  try {
    const raw = await chatJson<unknown>(
      buildSitePrompt({
        businessName,
        industry,
        domain,
        tagline,
        brief,
        primaryColor,
      }),
    );
    const parsed = parseSitePayload(raw);
    if (!parsed.ok) throw new AiError("invalid_response", parsed.error);
    payload = parsed.site;
  } catch (err) {
    await markFailed(siteId!, err);
    await logAudit({
      action: AUDIT.AI_SITE_GENERATION_FAILED,
      entity: "builder_site",
      entityId: siteId!,
      actorId: ctx.userId,
      meta: { businessName },
    });
    return fail(503, err instanceof AiError ? err.message : "A geração falhou. Tente novamente mais tarde.");
  }

  const pagesJson = payload.pages.map((p, index) => ({
    slug: p.slug,
    title: p.title,
    nav_label: p.navLabel ?? p.title,
    sort: index,
    sections: p.sections,
  }));
  const { error: rpcErr } = await supabaseAdmin.rpc("replace_builder_pages", {
    p_site_id: siteId,
    p_pages: pagesJson,
  });
  if (rpcErr) {
    serverLogError("ai-builder:replace-pages", rpcErr);
    await markFailed(siteId!, rpcErr);
    return fail(500, "Não foi possível guardar o site gerado.");
  }

  const theme: Record<string, unknown> = { ...existingTheme, ...(payload.theme ?? {}), ...(primaryColor ? { primaryColor } : {}) };

  await supabaseAdmin
    .from("builder_sites")
    .update({
      title: payload.name,
      tagline: tagline || payload.tagline || "",
      theme,
      seo: payload.seo ?? {},
      status: "ready",
      error: null,
      generated_at: new Date().toISOString(),
    })
    .eq("id", siteId);

  // Tie-in: represent the generated site as a real project, so it also shows on
  // the Websites dashboard. Non-critical: keep generating even if this fails.
  const ownedNow = await ownerSite(siteId!, ctx.userId);
  if (ownedNow && !ownedNow.row.project_id) {
    const { data: project } = await supabaseAdmin
      .from("projects")
      .insert({
        client_id: ctx.userId,
        title: `${businessName} — Website IA`.slice(0, 200),
        description: brief.slice(0, 2000),
        category: "website",
        status: "draft",
      })
      .select("id")
      .single();
    if (project) {
      await supabaseAdmin.from("builder_sites").update({ project_id: project.id }).eq("id", siteId!);
    }
  }

  await logAudit({
    action: AUDIT.AI_SITE_GENERATED,
    entity: "builder_site",
    entityId: siteId!,
    actorId: ctx.userId,
    meta: { businessName, pages: payload.pages.length },
  });
  await notifyEvent("ai_site.generated", { businessName });

  return { ok: true, siteId: siteId!, pages: payload.pages.length };
}

export type UpdateSiteInput = {
  businessName?: string;
  tagline?: string;
  domain?: string;
  industry?: string;
  brief?: string;
  primaryColor?: string;
};

export async function updateSite(ctx: AuthContext, siteId: string, input: UpdateSiteInput): Promise<ServiceResult<{ site: BuilderSite }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");
  const owned = await ownerSite(siteId, ctx.userId);
  if (!owned) return fail(404, "Site não encontrado.");

  const patch: Record<string, unknown> = {};
  if (input.businessName !== undefined) patch.business_name = input.businessName.trim().slice(0, 160);
  if (input.brief !== undefined) patch.brief = input.brief.trim().slice(0, 4000);
  if (input.tagline !== undefined) patch.tagline = input.tagline.trim().slice(0, 300);
  if (input.domain !== undefined) patch.domain = input.domain.trim().slice(0, 200) || null;
  if (input.industry !== undefined) patch.industry = input.industry.trim().slice(0, 120) || null;
  if (input.primaryColor !== undefined) {
    const color = input.primaryColor.trim().match(/^#[0-9a-fA-F]{3,8}$/)?.[0];
    patch.theme = { ...owned.theme, ...(color ? { primaryColor: color } : {}) };
  }
  if (Object.keys(patch).length === 0) return fail(400, "Nada para atualizar.");

  const { data, error } = await supabaseAdmin.from("builder_sites").update(patch).eq("id", siteId).select("*").single();
  if (error || !data) {
    serverLogError("ai-builder:update", error ?? new Error("update failed"));
    return fail(500, "Não foi possível atualizar o site.");
  }
  return { ok: true, site: toSite(data as BuilderSiteRow) };
}

export async function saveSections(
  ctx: AuthContext,
  siteId: string,
  pageId: string,
  sectionsInput: unknown,
): Promise<ServiceResult<{ page: Pick<BuilderPage, "id" | "sections"> }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");
  const owned = await ownerSite(siteId, ctx.userId);
  if (!owned) return fail(404, "Site não encontrado.");

  const { data: page } = await supabaseAdmin
    .from("builder_pages")
    .select("id")
    .eq("id", pageId)
    .eq("site_id", siteId)
    .single();
  if (!page) return fail(404, "Página não encontrada.");

  const parsed = parseSectionsInput(sectionsInput);
  if (!parsed.ok) return fail(400, parsed.error);

  const { error } = await supabaseAdmin.from("builder_pages").update({ sections: parsed.sections }).eq("id", pageId);
  if (error) {
    serverLogError("ai-builder:save-sections", error);
    return fail(500, "Não foi possível guardar as secções.");
  }
  return { ok: true, page: { id: pageId, sections: parsed.sections } };
}

export type RewriteSectionInput = {
  pageId: string;
  index: number;
  instruction: string;
};

export async function rewriteSection(
  ctx: AuthContext,
  siteId: string,
  input: RewriteSectionInput,
): Promise<ServiceResult<{ section: ParsedSection }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");

  const owned = await ownerSite(siteId, ctx.userId);
  if (!owned) return fail(404, "Site não encontrado.");

  const instruction = input.instruction.trim().slice(0, 500);
  if (!instruction) return fail(400, "Descreva o que pretende alterar na secção.");
  if (!Number.isInteger(input.index) || input.index < 0) return fail(400, "Secção inválida.");
  if (!isAiConfigured()) return fail(503, "A geração por IA ainda não está configurada. Contacte o apoio.");

  const { data: page } = await supabaseAdmin
    .from("builder_pages")
    .select("id, title, sections")
    .eq("id", input.pageId)
    .eq("site_id", siteId)
    .single();
  if (!page) return fail(404, "Página não encontrada.");

  const sections = Array.isArray(page.sections) ? (page.sections as ParsedSection[]) : [];
  const current = sections[input.index];
  if (!current) return fail(400, "A secção pedida não existe.");

  let rewritten: ParsedSection;
  try {
    const raw = await chatJson<unknown>(
      buildRewriteSectionPrompt({
        businessName: owned.row.business_name,
        brief: owned.row.brief,
        pageTitle: page.title,
        section: current,
        instruction,
      }),
    );
    const parsed = parseSectionPayload(raw);
    if (!parsed.ok) throw new AiError("invalid_response", parsed.error);
    rewritten = parsed.section;
  } catch (err) {
    await logAudit({
      action: AUDIT.AI_SITE_GENERATION_FAILED,
      entity: "builder_site",
      entityId: siteId,
      actorId: ctx.userId,
      meta: { businessName: owned.row.business_name, pageId: page.id },
    });
    return fail(503, err instanceof AiError ? err.message : "A reescrita falhou. Tente novamente.");
  }

  const next = [...sections];
  next[input.index] = rewritten;
  const { error } = await supabaseAdmin.from("builder_pages").update({ sections: next }).eq("id", page.id);
  if (error) {
    serverLogError("ai-builder:rewrite", error);
    return fail(500, "Não foi possível guardar a secção reescrita.");
  }
  return { ok: true, section: rewritten };
}

export async function publishSite(ctx: AuthContext, siteId: string): Promise<ServiceResult<{ site: BuilderSite }>> {
  if (!ctx.userId) return fail(401, "Não autenticado.");
  const owned = await ownerSite(siteId, ctx.userId);
  if (!owned) return fail(404, "Site não encontrado.");
  if (owned.row.status !== "ready") return fail(400, "O site ainda não tem conteúdo gerado.");

  const { data, error } = await supabaseAdmin
    .from("builder_sites")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", siteId)
    .select("*")
    .single();
  if (error || !data) {
    serverLogError("ai-builder:publish", error ?? new Error("update failed"));
    return fail(500, "Não foi possível publicar o site.");
  }

  await logAudit({
    action: AUDIT.AI_SITE_PUBLISHED,
    entity: "builder_site",
    entityId: siteId,
    actorId: ctx.userId,
    meta: { businessName: owned.row.business_name },
  });
  await notifyEvent("ai_site.published", { businessName: owned.row.business_name });

  return { ok: true, site: toSite(data as BuilderSiteRow) };
}