"use client";

import { useState } from "react";

import { Button, TextField } from "@/components/ui/core";
import { useToast } from "@/components/ui/core";
import type { DnsBundle } from "@/lib/dns/types";
import { dnsApi } from "@/lib/dns/client-api";
import { useDnsBundle } from "@/components/dns/dns-shared";

export default function DnsNameserversView({ fullDomain, initialBundle }: { fullDomain: string; initialBundle: DnsBundle }) {
  const { bundle, setBundle } = useDnsBundle(fullDomain, initialBundle);
  const { toast } = useToast();

  const [ns, setNs] = useState<Record<string, string>>(() => ({
    ns1: bundle.zone.nameservers.ns1 ?? "",
    ns2: bundle.zone.nameservers.ns2 ?? "",
    ns3: bundle.zone.nameservers.ns3 ?? "",
    ns4: bundle.zone.nameservers.ns4 ?? "",
  }));
  const [busy, setBusy] = useState(false);

  const keys = ["ns1", "ns2", "ns3", "ns4"] as const;

  async function save() {
    setBusy(true);
    try {
      const result = await dnsApi.updateNameservers(fullDomain, ns);
      setBundle(result.bundle);
      toast("ok", "Nameservers updated successfully.");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Erro ao guardar os nameservers.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display-2 text-lg font-semibold tracking-tight">Nameservers</h2>
        <p className="mt-1 text-sm text-muted">
          Servidores de nomes para onde <span className="text-paper">@{fullDomain}</span> aponta. Necessários para ligar o
          domínio ao website e ao email.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {keys.map((key) => (
          <TextField
            key={key}
            label={key.toUpperCase()}
            size="md"
            value={ns[key] ?? ""}
            onChange={(event) => setNs((prev) => ({ ...prev, [key]: event.target.value }))}
            placeholder="ns.example.com"
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="brand" size="sm" type="button" onClick={save} loading={busy}>
          {busy ? "A guardar…" : "Guardar alterações"}
        </Button>
      </div>

      <p className="rounded-lg border border-line bg-ink px-4 py-3 text-sm text-muted">
        {bundle.zone.provider === "local" ? (
          <>
            <span className="font-medium text-paper">Provider não ligado — configuração manual.</span>{" "}
            Guardou novos nameservers? Eles só ficam efetivos depois de os atualizar também no registrante do domínio. A
            propagação pode demorar até 24–48 horas.
          </>
        ) : (
          <>Os nameservers são geridos pelo provider {bundle.zone.provider}.</>
        )}
      </p>
    </div>
  );
}