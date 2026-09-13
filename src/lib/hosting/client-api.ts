import type {
  HostingOverview,
  HostingWebsite,
  HostingDatabase,
  HostingBackup,
  HostingSslCertificate,
  HostingCronJob,
  ResourceAlert,
  HostingActivityEntry,
  HostingSecurityReport,
  HostingPerformanceReport,
  HostingUsage,
} from "@/services/hosting-panel.service";

type ApiError = { ok: false; error: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON failure — surface a generic message.
  }
  const body = (json ?? {}) as Partial<ApiError>;
  if (!res.ok) {
    throw new Error(body.error ?? "Erro ao comunicar com o servidor.");
  }
  return json as T;
}

function mutInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

const base = (hostingId: string) => `/api/hosting/${encodeURIComponent(hostingId)}`;

export type OverviewResult = { overview: HostingOverview };

export const hostingApi = {
  overview(hostingId: string, signal?: AbortSignal): Promise<OverviewResult> {
    return request(base(hostingId), { signal });
  },
  refreshUsage(hostingId: string): Promise<{ usage: HostingUsage }> {
    return request(base(hostingId), mutInit("POST", { action: "refresh_usage" }));
  },

  websites(hostingId: string): Promise<{ websites: HostingWebsite[] }> {
    return request(`${base(hostingId)}/websites`);
  },
  createWebsite(hostingId: string, input: Record<string, unknown>): Promise<{ website: HostingWebsite }> {
    return request(`${base(hostingId)}/websites`, mutInit("POST", { action: "create", ...input }));
  },
  updateWebsite(hostingId: string, websiteId: string, patch: Record<string, unknown>): Promise<{ website: HostingWebsite }> {
    return request(`${base(hostingId)}/websites`, mutInit("POST", { action: "update", websiteId, patch }));
  },
  deleteWebsite(hostingId: string, websiteId: string): Promise<{ ok: true }> {
    return request(`${base(hostingId)}/websites`, mutInit("POST", { action: "delete", websiteId }));
  },
  setPhp(hostingId: string, websiteId: string, phpVersion: string): Promise<{ website: HostingWebsite }> {
    return request(`${base(hostingId)}/websites`, mutInit("POST", { action: "php", websiteId, phpVersion }));
  },

  databases(hostingId: string): Promise<{ databases: HostingDatabase[] }> {
    return request(`${base(hostingId)}/databases`);
  },
  createDatabase(hostingId: string, name: string): Promise<{ database: HostingDatabase; password: string }> {
    return request(`${base(hostingId)}/databases`, mutInit("POST", { action: "create", name }));
  },
  deleteDatabase(hostingId: string, databaseId: string): Promise<{ ok: true }> {
    return request(`${base(hostingId)}/databases`, mutInit("POST", { action: "delete", databaseId }));
  },
  resetDatabasePassword(hostingId: string, databaseId: string): Promise<{ password: string }> {
    return request(`${base(hostingId)}/databases`, mutInit("POST", { action: "reset_password", databaseId }));
  },

  backups(hostingId: string): Promise<{ backups: HostingBackup[] }> {
    return request(`${base(hostingId)}/backups`);
  },
  createBackup(hostingId: string, input: Record<string, unknown>): Promise<{ backup: HostingBackup }> {
    return request(`${base(hostingId)}/backups`, mutInit("POST", { action: "create", ...input }));
  },
  restoreBackup(hostingId: string, backupId: string): Promise<{ backup: HostingBackup }> {
    return request(`${base(hostingId)}/backups`, mutInit("POST", { action: "restore", backupId }));
  },
  deleteBackup(hostingId: string, backupId: string): Promise<{ ok: true }> {
    return request(`${base(hostingId)}/backups`, mutInit("POST", { action: "delete", backupId }));
  },

  ssl(hostingId: string): Promise<{ certificates: HostingSslCertificate[] }> {
    return request(`${base(hostingId)}/ssl`);
  },
  installSsl(hostingId: string, domain: string): Promise<{ certificate: HostingSslCertificate }> {
    return request(`${base(hostingId)}/ssl`, mutInit("POST", { action: "install", domain }));
  },
  renewSsl(hostingId: string, certificateId: string): Promise<{ certificate: HostingSslCertificate }> {
    return request(`${base(hostingId)}/ssl`, mutInit("POST", { action: "renew", certificateId }));
  },
  removeSsl(hostingId: string, certificateId: string): Promise<{ ok: true }> {
    return request(`${base(hostingId)}/ssl`, mutInit("POST", { action: "remove", certificateId }));
  },

  security(hostingId: string): Promise<{ report: HostingSecurityReport }> {
    return request(`${base(hostingId)}/security`);
  },
  performance(hostingId: string): Promise<{ report: HostingPerformanceReport }> {
    return request(`${base(hostingId)}/performance`);
  },

  cron(hostingId: string): Promise<{ jobs: HostingCronJob[] }> {
    return request(`${base(hostingId)}/advanced`);
  },
  createCron(hostingId: string, input: Record<string, unknown>): Promise<{ job: HostingCronJob }> {
    return request(`${base(hostingId)}/advanced`, mutInit("POST", { action: "cron_create", ...input }));
  },
  updateCron(hostingId: string, jobId: string, patch: Record<string, unknown>): Promise<{ job: HostingCronJob }> {
    return request(`${base(hostingId)}/advanced`, mutInit("POST", { action: "cron_update", jobId, patch }));
  },
  deleteCron(hostingId: string, jobId: string): Promise<{ ok: true }> {
    return request(`${base(hostingId)}/advanced`, mutInit("POST", { action: "cron_delete", jobId }));
  },

  alerts(hostingId: string): Promise<{ alerts: ResourceAlert[] }> {
    return request(`${base(hostingId)}/alerts`);
  },
  ackAlert(hostingId: string, alertId: string): Promise<{ ok: true }> {
    return request(`${base(hostingId)}/alerts`, mutInit("POST", { action: "ack", alertId }));
  },

  activity(hostingId: string): Promise<{ activities: HostingActivityEntry[] }> {
    return request(`${base(hostingId)}/activity`);
  },
};