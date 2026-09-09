"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ListTree, RefreshCw, Server, ShieldCheck } from "lucide-react";

import { Button, DashboardCard, StatusBadge, useToast } from "@/components/ui/core";
import type { DnsBundle } from "@/lib/dns/types";
import { ZONE_STATUS_LABELS } from "@/lib/dns/types";
import { dnsApi } from "@/lib/dns/client-api";
import { useDnsBundle, DnssecPill } from "@/components/dns/dns-shared";
import PropagationModal, { type PropagationState } from "@/components/dns/dns-propagation-modal";

export default function DnsOverviewView({ fullDomain, initialBundle }: { fullDomain: string; initialBundle: DnsBundle }) {
  const { bundle, setBundle } = useDnsBundle(fullDomain, initialBundle);
  const { toast } = useToast();
  const [propagation, setPropagation] = useState<PropagationState>({ state: "idle", checks: [] });

  const zone = bundle.zone;

  async function runPropagation() {
    setPropagation((prev) => ({ ...prev, state: "checking" }));
    try {
      const result = await dnsApi.checkPropagation(fullDomain);
      setBundle(result.bundle);
      setPropagation({ state: "done", checks: result.checks });
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Erro ao verificar a propagação.");
      setPropagation((prev) => ({ ...prev, state: "idle" }));
    }
  }

  const base = `/dashboard/domains/${encodeURIComponent(fullDomain)}`;

  const links = [
    { href: `${base}/dns`, label: "DNS Management", hint: "Gerir registos DNS", icon: ListTree },
    { href: `${base}/nameservers`, label: "Nameservers", hint: "Alterar servidores de nomes", icon: Server },
    { href: `${base}/security`, label: "Security", hint: "DNSSEC e proteção", icon: ShieldCheck },
    { href: `${base}/activity`, label: "Activity", hint: "Histórico de alterações", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          label="Estado da zona"
          value={ZONE_STATUS_LABELS[zone.status]}
          sub={`Provider: ${zone.provider}`}
          accent={zone.status === "error" ? "muted" : zone.status === "active" ? "ok" : "brand"}
        />
        <DashboardCard label="Registos DNS" value={String(bundle.records.length)} sub="A/AAAA, MX, TXT, SRV…" />
        <DashboardCard
          label="Nameservers"
          value={zone.nameservers.ns1 ?? "—"}
          sub={zone.nameservers.ns2 ?? "—"}
          icon={<Server className="size-5" />}
        />
        <DashboardCard
          label="DNSSEC"
          value={<DnssecPill status={zone.dnssec} />}
          sub="Estado real, nunca simulado"
          accent={zone.dnssec === "active" ? "ok" : "brand"}
          icon={<ShieldCheck className="size-5" />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5">
        <div>
          <h3 className="font-medium">Verificação de propagação</h3>
          <p className="mt-1 text-sm text-muted">
            Consulta o estado público do DNS em tempo real (DNS-over-HTTPS) e compara com os registos desta zona.
          </p>
        </div>
        <Button variant="brand" size="sm" type="button" onClick={runPropagation}>
          <RefreshCw className="mr-1.5 size-4" />
          Verificar DNS
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand"
            >
              <Icon className="size-5 text-brand" />
              <p className="mt-3 text-sm font-semibold">{link.label}</p>
              <p className="mt-1 text-xs text-muted">{link.hint}</p>
            </Link>
          );
        })}
      </div>

      {zone.provider === "local" ? (
        <p className="rounded-xl border border-line bg-ink px-4 py-3 text-sm text-muted">
          <StatusBadge tone="warn" className="mr-2">Pendente</StatusBadge>
          Provider de DNS ainda não ligado — os registos são geridos internamente e ficam <span className="text-paper">Pending Configuration / Manual Setup Required</span> até
          configurados no registrante.
        </p>
      ) : null}

      <PropagationModal fullDomain={fullDomain} state={propagation} onRetry={runPropagation} onClose={() => setPropagation({ state: "idle", checks: [] })} />
    </div>
  );
}