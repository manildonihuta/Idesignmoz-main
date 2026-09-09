"use client";

import { useCallback, useState } from "react";

import type { DnsBundle } from "@/lib/dns/types";
import { DNSSEC_STATUSES, DNS_ZONE_STATUSES } from "@/lib/dns/types";
import { StatusBadge, type StatusTone } from "@/components/ui/core";
import { dnsApi } from "@/lib/dns/client-api";

export type { DnsBundle };

export function useDnsBundle(fullDomain: string, initial: DnsBundle) {
  const [bundle, setBundle] = useState<DnsBundle>(initial);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dnsApi.bundle(fullDomain);
      setBundle(result.bundle);
    } finally {
      setLoading(false);
    }
  }, [fullDomain]);

  return { bundle, setBundle, refresh, loading };
}

const ZONE_TONES: Record<(typeof DNS_ZONE_STATUSES)[number], StatusTone> = {
  pending: "warn",
  active: "ok",
  disabled: "muted",
  error: "danger",
  manual: "brand",
};

const DNSSEC_TONES: Record<(typeof DNSSEC_STATUSES)[number], StatusTone> = {
  disabled: "muted",
  pending: "warn",
  active: "ok",
  error: "danger",
};

export function ZoneStatusPill({ status }: { status: (typeof DNS_ZONE_STATUSES)[number] }) {
  return <StatusBadge tone={ZONE_TONES[status]}>{status}</StatusBadge>;
}

export function DnssecPill({ status }: { status: (typeof DNSSEC_STATUSES)[number] }) {
  return <StatusBadge tone={DNSSEC_TONES[status]}>{status}</StatusBadge>;
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtValue(value: string): string {
  if (value.length <= 120) return value;
  return `${value.slice(0, 117)}…`;
}