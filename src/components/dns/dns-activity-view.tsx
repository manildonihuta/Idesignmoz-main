"use client";

import { useMemo, useState } from "react";
import {
  FilePlus2,
  FileMinus2,
  FilePenLine,
  Globe,
  KeyRound,
  KeySquare,
  Radar,
  Puzzle,
  RefreshCw,
} from "lucide-react";

import { SelectField } from "@/components/ui/core";
import type { DnsActivity, DnsBundle } from "@/lib/dns/types";
import { DNS_ACTIVITY_LABELS } from "@/lib/dns/types";
import { useDnsBundle, fmtDate } from "@/components/dns/dns-shared";

const ACTION_ICONS: Record<string, { icon: typeof Globe; tone: string }> = {
  zone_created: { icon: Globe, tone: "text-sky-400" },
  record_created: { icon: FilePlus2, tone: "text-emerald-400" },
  record_updated: { icon: FilePenLine, tone: "text-amber-400" },
  record_deleted: { icon: FileMinus2, tone: "text-rose-400" },
  nameservers_updated: { icon: Radar, tone: "text-violet-400" },
  dnssec_enabled: { icon: KeyRound, tone: "text-emerald-400" },
  dnssec_disabled: { icon: KeySquare, tone: "text-muted" },
  template_applied: { icon: Puzzle, tone: "text-emerald-400" },
  propagation_checked: { icon: RefreshCw, tone: "text-sky-400" },
  zone_synced: { icon: RefreshCw, tone: "text-violet-400" },
};

function iconFor(action: string): { icon: typeof Globe; tone: string } {
  return ACTION_ICONS[action] ?? { icon: Globe, tone: "text-muted" };
}

export default function DnsActivityView({ fullDomain, initialBundle }: { fullDomain: string; initialBundle: DnsBundle }) {
  const { bundle } = useDnsBundle(fullDomain, initialBundle);
  const [filter, setFilter] = useState("all");

  const activities = bundle.activities;

  const filtered = useMemo(() => {
    if (filter === "all") return activities;
    return activities.filter((a) => a.action === filter);
  }, [activities, filter]);

  const actionOptions = useMemo(() => {
    const keys = [...new Set(activities.map((a) => a.action))];
    return [
      { value: "all", label: "Todas as ações" },
      ...keys.map((key) => ({ value: key, label: DNS_ACTIVITY_LABELS[key] ?? key })),
    ];
  }, [activities]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display-2 text-lg font-semibold tracking-tight">Activity</h2>
          <p className="mt-1 text-sm text-muted">
            Histórico de alterações DNS de <span className="text-paper">@{fullDomain}</span>.
          </p>
        </div>
        <SelectField size="sm" value={filter} onChange={(event) => setFilter(event.target.value)} options={actionOptions} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-sm text-muted">Sem atividade registada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ entry }: { entry: DnsActivity }) {
  const { icon: Icon, tone } = iconFor(entry.action);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${tone}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{DNS_ACTIVITY_LABELS[entry.action] ?? entry.action}</p>
            <time className="text-xs text-muted">{fmtDate(entry.createdAt)}</time>
          </div>
          {entry.recordType ? (
            <p className="mt-1 text-xs text-muted">
              <span className="font-mono">{entry.recordType}</span>
              {entry.recordId ? <span className="ml-2 text-[11px] opacity-60">#{entry.recordId.slice(0, 8)}</span> : null}
            </p>
          ) : null}
          {entry.oldValue && entry.newValue && entry.oldValue !== entry.newValue ? (
            <div className="mt-2 space-y-1 rounded-lg border border-line bg-ink p-2 text-[11px]">
              <p className="text-muted line-through decoration-rose-400/50">{entry.oldValue}</p>
              <p className="text-paper">{entry.newValue}</p>
            </div>
          ) : entry.oldValue && !entry.newValue ? (
            <p className="mt-2 break-all rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-1 text-[11px] text-muted line-through decoration-rose-400/50">
              {entry.oldValue}
            </p>
          ) : entry.newValue ? (
            <p className="mt-2 break-all rounded-lg border border-line bg-ink px-2 py-1 text-[11px] text-paper">{entry.newValue}</p>
          ) : null}
          {entry.meta && Object.keys(entry.meta).length > 0 ? (
            <p className="mt-2 text-[11px] text-muted">{JSON.stringify(entry.meta)}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}