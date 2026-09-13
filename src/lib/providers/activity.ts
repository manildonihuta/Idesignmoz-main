import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";

export type ActivityLevel = "info" | "warn" | "error";

export type ActivityMeta = Record<string, unknown>;

export type ActivityLogRow = {
  id: string;
  provider_id: string | null;
  event: string;
  level: ActivityLevel;
  message: string;
  meta: ActivityMeta | null;
  created_at: string;
};

export type SafeActivityLog = {
  id: string;
  providerId: string | null;
  providerSlug?: string;
  event: string;
  level: ActivityLevel;
  message: string;
  createdAt: string;
};

/**
 * Append-only provider observability trail. Never pass credentials into
 * message/meta — they would land in plaintext forever.
 */
export async function logProviderActivity(entry: {
  providerId?: string | null;
  event: string;
  level?: ActivityLevel;
  message?: string;
  meta?: ActivityMeta;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("provider_activity_logs").insert({
    provider_id: entry.providerId ?? null,
    event: entry.event,
    level: entry.level ?? "info",
    message: entry.message ?? "",
    meta: entry.meta ?? null,
  });
  if (error) {
    serverLogError("infra:activity", error, { event: entry.event });
  }
}

export async function listProviderActivity(
  opts?: { providerId?: string; limit?: number; minLevel?: ActivityLevel },
): Promise<SafeActivityLog[]> {
  let query = supabaseAdmin
    .from("provider_activity_logs")
    .select("provider_activity_logs.*, providers (slug)")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts?.limit ?? 50, 200));

  if (opts?.providerId) query = query.eq("provider_id", opts.providerId);
  if (opts?.minLevel === "error") query = query.eq("level", "error");
  if (opts?.minLevel === "warn") query = query.in("level", ["warn", "error"]);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data ?? []).map((row) => {
    const base = row as unknown as ActivityLogRow;
    const provider = (row as unknown as { providers: { slug: string } | { slug: string }[] | null }).providers;
    const slug = Array.isArray(provider) ? provider[0]?.slug : provider?.slug;
    return {
      id: base.id,
      providerId: base.provider_id,
      providerSlug: slug ?? undefined,
      event: base.event,
      level: base.level,
      message: base.message,
      createdAt: base.created_at,
    };
  });
}

export async function countProviderErrors(opts?: { providerId?: string; sinceHours?: number }): Promise<number> {
  const since = new Date(Date.now() - (opts?.sinceHours ?? 24) * 3_600_000).toISOString();
  let query = supabaseAdmin
    .from("provider_activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("level", "error")
    .gte("created_at", since);
  if (opts?.providerId) query = query.eq("provider_id", opts.providerId);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}