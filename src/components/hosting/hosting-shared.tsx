"use client";

import { useCallback, useContext, createContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { HostingOverview } from "@/services/hosting-panel.service";
import type { HostingCapability } from "@/lib/provisioning/hosting/types";
import { StatusBadge, type StatusTone } from "@/components/ui/core";
import { hostingApi } from "@/lib/hosting/client-api";

export function fmtBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** i).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} ${units[i]}`;
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Local state owner for an overview bundle; refresh() re-pulls from the API. */
export function useHostingBundle(hostingId: string, initial?: HostingOverview | null) {
  const [bundle, setBundle] = useState<HostingOverview | null>(initial ?? null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await hostingApi.overview(hostingId);
      setBundle(result.overview);
    } finally {
      setLoading(false);
    }
  }, [hostingId]);

  return { bundle, setBundle, refresh, loading };
}

export const HostingPanelContext = createContext<{ bundle: HostingOverview | null }>({ bundle: null });

/** Access the shared overview bundle (provider capabilities + plan) from any
 * section view inside the hosting shell. */
export function useHostingPanel() {
  return useContext(HostingPanelContext);
}

/** Generic fetch-to-state helper used by the section views. `key` keeps the
 * loader stable so refresh-only re-runs don't loop. */
export function useSectionData<T>(key: string, fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fnRef.current())
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { data, setData, error, loading, reload: load };
}

/* ------------------------------------------------------------------ */
/* Status pills                                                       */
/* ------------------------------------------------------------------ */

const ACCOUNT_TONES: Record<string, StatusTone> = {
  active: "ok",
  suspended: "warn",
  provisioning: "brand",
  terminated: "danger",
  cancelled: "muted",
};

const WEBSITE_TONES: Record<string, StatusTone> = {
  online: "ok",
  offline: "danger",
  suspended: "warn",
  error: "danger",
};

const SSL_TONES: Record<string, StatusTone> = {
  active: "ok",
  pending: "warn",
  renewing: "brand",
  expired: "danger",
  failed: "danger",
};

const BACKUP_TONES: Record<string, StatusTone> = {
  completed: "ok",
  queued: "muted",
  processing: "brand",
  restoring: "brand",
  failed: "danger",
};

const ALERT_TONES: Record<string, StatusTone> = {
  info: "muted",
  warn: "warn",
  danger: "danger",
};

const ACCOUNT_LABELS: Record<string, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  provisioning: "A ativar",
  terminated: "Terminada",
  cancelled: "Cancelada",
};

const WEBSITE_LABELS: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  suspended: "Suspenso",
  error: "Erro",
};

export function AccountStatusPill({ status }: { status: string }) {
  return <StatusBadge tone={ACCOUNT_TONES[status] ?? "muted"}>{ACCOUNT_LABELS[status] ?? status}</StatusBadge>;
}

export function WebsiteStatusPill({ status }: { status: string }) {
  return <StatusBadge tone={WEBSITE_TONES[status] ?? "muted"}>{WEBSITE_LABELS[status] ?? status}</StatusBadge>;
}

export function SslStatusPill({ status }: { status: string }) {
  return <StatusBadge tone={SSL_TONES[status] ?? "muted"}>{status}</StatusBadge>;
}

export function BackupStatusPill({ status }: { status: string }) {
  return <StatusBadge tone={BACKUP_TONES[status] ?? "muted"}>{status}</StatusBadge>;
}

export function AlertTonePill({ level }: { level: string }) {
  return <StatusBadge tone={ALERT_TONES[level] ?? "muted"}>{level}</StatusBadge>;
}

/* ------------------------------------------------------------------ */
/* Capability gate + empty state                                      */
/* ------------------------------------------------------------------ */

export function NotIncluded({ feature }: { feature: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center">
      <p className="text-sm font-medium text-paper">{feature}</p>
      <p className="mt-1 text-sm text-muted">
        Funcionalidade não incluída no teu plano/provedor. Gerimos isto por ti — pede-nos assistência se precisares.
      </p>
    </div>
  );
}

export function CapabilityGate({
  capabilities,
  required,
  feature,
  children,
}: {
  capabilities: readonly HostingCapability[] | undefined;
  required: HostingCapability;
  feature: string;
  children: ReactNode;
}) {
  if (!capabilities?.includes(required)) return <NotIncluded feature={feature} />;
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Usage bar                                                          */
/* ------------------------------------------------------------------ */

export function UsageBar({
  label,
  used,
  limit,
  percent,
}: {
  label: string;
  used: string;
  limit: string;
  percent: number | null;
}) {
  const value = percent ?? 0;
  const tone = percent == null ? "bg-surface-2" : value >= 90 ? "bg-brand" : "bg-ok";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-paper">
          {used} <span className="text-xs font-normal text-muted">/ {limit}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {percent != null ? (
        <p className="mt-1 text-xs text-muted">
          {Math.round(percent)}% utilizado
          {percent >= 90 ? " — recomendamos reforçar o plano." : ""}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">Sem limite definido no plano.</p>
      )}
    </div>
  );
}