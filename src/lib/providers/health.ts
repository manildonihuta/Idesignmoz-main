import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { notifyEvent } from "@/lib/notifications";
import type { ProviderHealthState, ProviderStatus } from "./types";
import { PROVIDER_HEALTH_LABEL } from "./types";
import { classifyProviderError } from "./errors";
import { logProviderActivity } from "./activity";
import { resolveBuiltinProvider, resolveHostingAdapter, resolveRegistrarAdapter } from "./registry";
import { cloudflareConfigured, cloudflareVerifyToken } from "@/lib/dns/providers/cloudflare";

export type HealthProbeResult = {
  status: ProviderHealthState;
  responseTimeMs?: number;
  errorClass?: string;
  errorMessage?: string;
  rateLimitRemaining?: number;
};

export type ProviderHealthCheckRow = {
  id: string;
  provider_id: string;
  status: ProviderHealthState;
  response_time_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  rate_limit_remaining: number | null;
  checked_at: string;
};

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: ProviderStatus;
};

const OK_MSG: Record<string, string> = {
  hosting: "Provedor de alojamento operacional.",
  dns: "Zonas DNS acessíveis.",
  domain: "Registrador operacional.",
  ssl: "Emitente SSL configurado.",
  email: "Serviço de email configurado.",
};

/** Truthful probe for a built-in provider. Simulated/local adapters are DB-only. */
async function probeBuiltin(slug: string, type: string): Promise<HealthProbeResult> {
  const started = performance.now();

  try {
    switch (slug) {
      case "hosting-simulated":
      case "domain-simulated":
        return {
          status: "healthy",
          responseTimeMs: Math.round(performance.now() - started),
          errorMessage: OK_MSG[type],
        };

      case "hosting-cpanel-whm":
      case "hosting-plesk":
      case "hosting-cloud-vps": {
        const provider = resolveHostingAdapter(null);
        if (!provider.configured) {
          return {
            status: "unavailable",
            responseTimeMs: Math.round(performance.now() - started),
            errorClass: "authentication",
            errorMessage: "Provedor sem credenciais configuradas.",
          };
        }
        const ok = Boolean(process.env.WHM_HOST || provider.configured);
        return {
          status: ok ? "healthy" : "degraded",
          responseTimeMs: Math.round(performance.now() - started),
          errorClass: ok ? undefined : "authentication",
          errorMessage: ok ? "Credenciais presentes; sem chamada de produção no health check." : "Configuração incompleta.",
        };
      }

      case "dns-local": {
        // Real probe: measure a quick platform DB read (DNS is hosted here).
        const { data, error } = await supabaseAdmin
          .from("dns_zones")
          .select("id", { count: "exact", head: true })
          .limit(1);
        return {
          status: error ? "unavailable" : "healthy",
          responseTimeMs: Math.round(performance.now() - started),
          errorClass: error ? "provider_unavailable" : undefined,
          errorMessage: error ? "Falha ao ler o registo DNS." : `${data?.length ?? 0} zona(s) acessível(eis).`,
        };
      }

      case "dns-cloudflare": {
        // Real probe: Cloudflare /user/tokens/verify with the bearer token.
        if (!cloudflareConfigured()) {
          return {
            status: "unavailable",
            responseTimeMs: Math.round(performance.now() - started),
            errorClass: "authentication",
            errorMessage: "Credenciais Cloudflare ausentes.",
          };
        }
        const ok = await cloudflareVerifyToken();
        return {
          status: ok ? "healthy" : "unavailable",
          responseTimeMs: Math.round(performance.now() - started),
          errorClass: ok ? undefined : "authentication",
          errorMessage: ok ? "Token Cloudflare válido; API acessível." : "Token Cloudflare inválido ou sem permissão.",
        };
      }

      case "domain-namecheap": {
        const registrar = resolveRegistrarAdapter("namecheap");
        if (!registrar.configured) {
          return {
            status: "unavailable",
            responseTimeMs: Math.round(performance.now() - started),
            errorClass: "authentication",
            errorMessage: "Credenciais do registrador ausentes.",
          };
        }
        return {
          status: "healthy",
          responseTimeMs: Math.round(performance.now() - started),
          errorMessage: "Credenciais presentes; sem chamada de produção no health check.",
        };
      }

      default:
        return {
          status: "unavailable",
          responseTimeMs: Math.round(performance.now() - started),
          errorClass: "temporary",
          errorMessage: "Sem adaptador ligado a este fornecedor.",
        };
    }
  } catch (err) {
    const classified = classifyProviderError(err);
    return {
      status: classified.retryable ? "degraded" : "unavailable",
      responseTimeMs: Math.round(performance.now() - started),
      errorClass: classified.kind,
      errorMessage: classified.message,
    };
  }
}

export async function lastHealthCheck(providerId: string): Promise<ProviderHealthCheckRow | null> {
  const { data, error } = await supabaseAdmin
    .from("provider_health_checks")
    .select("*")
    .eq("provider_id", providerId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProviderHealthCheckRow;
}

/** Verifies a single provider: probe, persist the check, update provider state. */
export async function checkProviderHealth(providerId: string): Promise<HealthProbeResult> {
  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("id, slug, name, type, status")
    .eq("id", providerId)
    .maybeSingle();
  if (error || !data) {
    return { status: "unknown", errorClass: "validation", errorMessage: "Provedor não encontrado." };
  }
  const row = data as ProviderRow;

  const def = resolveBuiltinProvider(row.slug);
  const result = def ? await probeBuiltin(def.slug, row.type) : { status: "unknown" as const, errorMessage: "Fornecedor externo — sem probe automático." };

  const now = new Date().toISOString();
  const { error: insertError } = await supabaseAdmin.from("provider_health_checks").insert({
    provider_id: row.id,
    status: result.status,
    response_time_ms: result.responseTimeMs ?? null,
    error_class: result.errorClass ?? null,
    error_message: result.errorMessage ?? null,
    rate_limit_remaining: result.rateLimitRemaining ?? null,
    checked_at: now,
  });
  if (insertError) {
    serverLogError("infra:health:insert", insertError, { providerId });
  }

  // Reflect health on the admin-controlled provider status without overriding
  // explicit admin choices (inactive / maintenance are left untouched).
  await updateProviderStatusFromHealth(row);

  await logProviderActivity({
    providerId: row.id,
    event: "health.check",
    level: result.status === "healthy" ? "info" : "warn",
    message: `Health check: ${PROVIDER_HEALTH_LABEL[result.status]}. ${result.errorMessage ?? ""}`,
    meta: { status: result.status, responseTimeMs: result.responseTimeMs, errorClass: result.errorClass },
  });

  return result;
}

async function updateProviderStatusFromHealth(row: ProviderRow): Promise<void> {
  if (row.status === "inactive" || row.status === "maintenance") return;
  const { data: latest, error } = await supabaseAdmin
    .from("provider_health_checks")
    .select("status")
    .eq("provider_id", row.id)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !latest) return;
  const healthy = latest.status === "healthy";
  const next = healthy ? "active" : "degraded";
  if (next === row.status) return;

  const { error: updateError } = await supabaseAdmin
    .from("providers")
    .update({ status: next, last_health_at: new Date().toISOString() })
    .eq("id", row.id);
  if (updateError) return;

  if (next === "degraded") {
    await notifyEvent("infra.provider_health", {
      provider: row.name,
      status: String(latest.status),
      message: `O fornecedor ${row.name} ficou indisponível ou degradado.`,
    });
  }
}

/** Runs the health cycle for every provider. Returns a summary. */
export async function runHealthChecks(limit = 50): Promise<{ checked: number; degraded: number; unavailable: number }> {
  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("id, status")
    .in("status", ["active", "degraded", "error", "unknown"])
    .order("sort", { ascending: true })
    .limit(limit);
  if (error || !data || data.length === 0) return { checked: 0, degraded: 0, unavailable: 0 };

  const summary = { checked: 0, degraded: 0, unavailable: 0 };
  for (const row of data as { id: string; status: string }[]) {
    const result = await checkProviderHealth(row.id);
    summary.checked += 1;
    if (result.status === "degraded") summary.degraded += 1;
    if (result.status === "unavailable") summary.unavailable += 1;
  }
  return summary;
}