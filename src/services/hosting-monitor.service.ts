import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";

export type HostingMonitorSummary = {
  checked: number;
  alertsCreated: number;
  notified: number;
};

type AlertSpec = { kind: string; level: "info" | "warn" | "danger"; message: string };

function dedupeAlerts(existing: Array<{ kind: string }>): (spec: AlertSpec) => boolean {
  const open = new Set(existing.map((a) => a.kind));
  return (spec) => !open.has(spec.kind);
}

async function openAlertKinds(hostingId: string): Promise<Array<{ kind: string }>> {
  const { data } = await supabaseAdmin
    .from("resource_alerts")
    .select("kind")
    .eq("hosting_account_id", hostingId)
    .eq("status", "open");
  return data ?? [];
}

async function insertAlert(hostingId: string, spec: AlertSpec): Promise<void> {
  await supabaseAdmin.from("resource_alerts").insert({
    hosting_account_id: hostingId,
    kind: spec.kind,
    level: spec.level,
    message: spec.message,
  });
}

/**
 * Hosting health monitor (cron): quota thresholds, SSL expiry, failed backups
 * and offline websites. Writes resource_alerts (deduped per open kind) and
 * pushes the matching staff events. Never raises a fake action — only reports
 * platform-managed state.
 */
export async function runHostingMonitor(limit = 50): Promise<HostingMonitorSummary> {
  const summary: HostingMonitorSummary = { checked: 0, alertsCreated: 0, notified: 0 };

  const { data: accounts, error } = await supabaseAdmin
    .from("hosting_accounts")
    .select("*")
    .eq("status", "active")
    .limit(limit);
  if (error || !accounts) {
    serverLogError("monitor:hosting.list", error ?? new Error("no accounts"));
    return summary;
  }

  for (const account of accounts) {
    summary.checked += 1;
    const hostingId = account.id;
    const domain = String(account.domain ?? "conta");

    try {
      const allowed = await openAlertKinds(hostingId);
      const canCreate = dedupeAlerts(allowed);

      const { data: plan } = await supabaseAdmin
        .from("hosting_plans")
        .select("storage_gb")
        .eq("id", account.plan_id ?? "")
        .maybeSingle();

      const [{ data: websites }, { data: databases }, { data: backups }, { data: ssl }] = await Promise.all([
        supabaseAdmin.from("hosting_websites").select("domain, status, storage_mb").eq("hosting_account_id", hostingId),
        supabaseAdmin.from("hosting_databases").select("size_mb").eq("hosting_account_id", hostingId),
        supabaseAdmin.from("hosting_backups").select("status").eq("hosting_account_id", hostingId),
        supabaseAdmin.from("hosting_ssl_certificates").select("domain, status, expires_at").eq("hosting_account_id", hostingId),
      ]);

      const storageMb =
        (websites ?? []).reduce((s, w) => s + Number(w.storage_mb ?? 0), 0) +
        (databases ?? []).reduce((s, d) => s + Number(d.size_mb ?? 0), 0);
      const storageGbLimit = Number(plan?.storage_gb ?? 0);

      if (storageGbLimit > 0) {
        const storageUsedGb = storageMb / 1024;
        const pct = (storageUsedGb / storageGbLimit) * 100;
        if (pct >= 90 && canCreate({ kind: "storage_90", level: "danger", message: `${domain} atingiu ${Math.round(pct)}% do armazenamento do plano.` })) {
          await insertAlert(hostingId, { kind: "storage_90", level: "danger", message: `${domain} atingiu ${Math.round(pct)}% do armazenamento do plano.` });
          summary.alertsCreated += 1;
        } else if (pct >= 80 && canCreate({ kind: "storage_80", level: "warn", message: `${domain} atingiu ${Math.round(pct)}% do armazenamento do plano.` })) {
          await insertAlert(hostingId, { kind: "storage_80", level: "warn", message: `${domain} atingiu ${Math.round(pct)}% do armazenamento do plano.` });
          summary.alertsCreated += 1;
        }
      }

      const failedBackups = (backups ?? []).filter((b) => b.status === "failed");
      if (failedBackups.length && canCreate({ kind: "backup_failed", level: "danger", message: `${domain} tem backup(s) com falha na criação.` })) {
        await insertAlert(hostingId, { kind: "backup_failed", level: "danger", message: `${domain} tem backup(s) com falha na criação.` });
        summary.alertsCreated += 1;
        await notifyEvent("hosting.backup.failed", { domain }, { channels: ["dashboard"] });
        summary.notified += 1;
      }

      const expiring = (ssl ?? []).filter((c) => {
        if (c.status !== "active" || !c.expires_at) return false;
        const days = (new Date(c.expires_at).getTime() - Date.now()) / 86400000;
        return days <= 14;
      });
      if (expiring.length && canCreate({ kind: "ssl_expiring", level: "warn", message: `${domain} tem certificado(s) SSL a expirar em ≤14 dias.` })) {
        await insertAlert(hostingId, { kind: "ssl_expiring", level: "warn", message: `${domain} tem certificado(s) SSL a expirar em ≤14 dias.` });
        summary.alertsCreated += 1;
        const daysLeft = Math.max(0, Math.round((new Date(expiring[0].expires_at).getTime() - Date.now()) / 86400000));
        await notifyEvent("hosting.ssl.expiring", { domain, daysLeft, expiresAt: new Date(expiring[0].expires_at).toLocaleDateString("pt-PT") }, { channels: ["dashboard"] });
        summary.notified += 1;
      }

      const offline = (websites ?? []).filter((w) => w.status === "offline" || w.status === "error");
      if (offline.length && canCreate({ kind: "website_offline", level: "warn", message: `${domain} tem ${offline.length} site(s) offline.` })) {
        await insertAlert(hostingId, { kind: "website_offline", level: "warn", message: `${domain} tem ${offline.length} site(s) offline.` });
        summary.alertsCreated += 1;
        await notifyEvent("hosting.website.offline", { domain: offline[0].domain }, { channels: ["dashboard"] });
        summary.notified += 1;
      }
    } catch (e) {
      serverLogError("monitor:hosting.account", e instanceof Error ? new Error(`${hostingId}: ${e.message}`) : e);
    }
  }

  return summary;
}