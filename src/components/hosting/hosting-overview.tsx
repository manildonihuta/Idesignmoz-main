"use client";

import Link from "next/link";
import { Archive, Bell, Database, Globe, Lock, RefreshCw, Server } from "lucide-react";

import { Button, DashboardCard, useToast } from "@/components/ui/core";
import type { HostingOverview } from "@/services/hosting-panel.service";
import { hostingApi } from "@/lib/hosting/client-api";
import { AccountStatusPill, fmtBytes, fmtDate, UsageBar, useHostingBundle } from "@/components/hosting/hosting-shared";

export default function HostingOverviewView({ hostingId, initial }: { hostingId: string; initial: HostingOverview }) {
  const { bundle, setBundle, loading } = useHostingBundle(hostingId, initial);
  const { toast } = useToast();

  if (!bundle) return null;
  const { account, plan, provider, usage, usagePercent, counts } = bundle;
  const base = `/dashboard/hosting/${hostingId}`;

  async function runRefresh() {
    try {
      const result = await hostingApi.refreshUsage(hostingId);
      toast("ok", "Uso atualizado.");
      setBundle((prev) => {
        if (!prev) return prev;
        const limit = prev.plan;
        return {
          ...prev,
          usage: result.usage,
          usagePercent: {
            storage: limit ? Math.min(200, Math.round((result.usage.storageMb / (limit.storageGb * 1024)) * 100)) : null,
            bandwidth: limit ? Math.min(200, Math.round((result.usage.bandwidthMb / (limit.bandwidthGb * 1024)) * 100)) : null,
            inodes: limit ? Math.min(200, Math.round((result.usage.inodes / limit.inodes) * 100)) : null,
          },
        };
      });
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Erro ao atualizar o uso.");
    }
  }

  const links = [
    { href: `${base}/websites`, label: "Sites", hint: `${counts.websites} site(s) alojados`, icon: Globe },
    { href: `${base}/databases`, label: "Bases de dados", hint: `${counts.databases} base(s) de dados`, icon: Database },
    { href: `${base}/backups`, label: "Backups", hint: `${counts.backups} backup(s)`, icon: Archive },
    { href: `${base}/ssl`, label: "SSL", hint: `${counts.ssl} certificado(s)`, icon: Lock },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          label="Estado da conta"
          value={<AccountStatusPill status={account.status} />}
          sub={account.serverIp ? `IP: ${account.serverIp}` : "A ativar"}
          accent={account.status === "active" ? "ok" : "brand"}
          icon={<Server className="size-5" />}
        />
        <DashboardCard label="Plano" value={plan?.name ?? "—"} sub={provider.mode === "simulated" ? "Simulado (provisório)" : provider.label} />
        <DashboardCard
          label="Renova em"
          value={fmtDate(account.renewsAt ?? account.expiresAt)}
          sub="Renovação automática"
          icon={<RefreshCw className="size-5" />}
        />
        <DashboardCard
          label="Alertas abertos"
          value={String(counts.alerts)}
          sub="Quotas e saúde da conta"
          accent={counts.alerts ? "brand" : "ok"}
          icon={<Bell className="size-5" />}
        />
      </div>

      {provider.capabilities.includes("usage") ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Utilização</h3>
              <p className="mt-1 text-sm text-muted">
                {usage ? `Medido a ${fmtDate(usage.measuredAt)}` : "Ainda sem medições — cria a primeira agora."}
              </p>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={runRefresh} loading={loading}>
              <RefreshCw className="mr-1.5 size-4" />
              Atualizar uso
            </Button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <UsageBar
              label="Armazenamento"
              used={fmtBytes((usage?.storageMb ?? 0) * 1024 * 1024)}
              limit={plan ? fmtBytes((plan.storageGb ?? 0) * 1024 * 1024 * 1024) : "—"}
              percent={plan ? usagePercent.storage : null}
            />
            <UsageBar
              label="Tráfego"
              used={fmtBytes((usage?.bandwidthMb ?? 0) * 1024 * 1024)}
              limit={plan ? fmtBytes(plan.bandwidthGb * 1024 * 1024 * 1024) : "—"}
              percent={plan ? usagePercent.bandwidth : null}
            />
            <UsageBar label="Inodes" used={String(usage?.inodes ?? 0)} limit={plan ? String(plan.inodes) : "—"} percent={plan ? usagePercent.inodes : null} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
          Utilização não disponível no teu provedor.
        </div>
      )}

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

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 font-medium">Plano {plan?.name ?? "—"}</h3>
        {plan ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
            <Detail label="CPU" value={`${plan.cpuCores} vCPU`} />
            <Detail label="Memória" value={`${plan.memoryMb} MB`} />
            <Detail label="Backups" value={plan.backups > 1 ? `${plan.backups} backups` : `${plan.backups} backup`} />
            <Detail label="Sites" value={plan.sites > 1 ? `${plan.sites} sites` : `${plan.sites} site`} />
            <Detail label="Bases de dados" value={String(plan.databases)} />
            <Detail label="Emails" value={String(plan.emailAccounts)} />
            <Detail label="PHP" value={plan.phpVersions.join(" · ")} />
            <Detail label="Painel" value={account.panelUrl ?? provider.label} />
          </dl>
        ) : (
          <p className="text-sm text-muted">Sem plano associado.</p>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-paper">{value}</dd>
    </div>
  );
}