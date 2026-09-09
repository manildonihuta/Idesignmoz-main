"use client";

import { useState } from "react";
import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button, IconTile, Modal, useToast } from "@/components/ui/core";
import type { DnsBundle } from "@/lib/dns/types";
import { DNSSEC_LABELS, ZONE_STATUS_LABELS } from "@/lib/dns/types";
import { dnsApi } from "@/lib/dns/client-api";
import { useDnsBundle, DnssecPill, ZoneStatusPill } from "@/components/dns/dns-shared";

export default function DnsSecurityView({ fullDomain, initialBundle }: { fullDomain: string; initialBundle: DnsBundle }) {
  const { bundle, setBundle } = useDnsBundle(fullDomain, initialBundle);
  const { toast } = useToast();

  const [confirm, setConfirm] = useState<null | "enable" | "disable">(null);
  const [busy, setBusy] = useState(false);

  const zone = bundle.zone;
  const dnssecActive = zone.dnssec !== "disabled";
  const localProvider = zone.provider === "local";

  async function toggle() {
    if (!confirm) return;
    setBusy(true);
    const enable = confirm === "enable";
    try {
      const result = await dnsApi.setDnssec(fullDomain, enable);
      setBundle(result.bundle);
      toast("ok", enable ? "DNSSEC enabled successfully." : "DNSSEC disabled successfully.");
      setConfirm(null);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Erro ao atualizar o DNSSEC.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display-2 text-lg font-semibold tracking-tight">Security</h2>
        <p className="mt-1 text-sm text-muted">
          Proteção do domínio <span className="text-paper">@{fullDomain}</span> — DNSSEC e bloqueio contra transferências.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconTile tone={dnssecActive && zone.dnssec !== "pending" ? "ok" : "muted"}>
                <ShieldCheck className="size-5" />
              </IconTile>
              <div>
                <h3 className="font-medium">DNSSEC</h3>
                <p className="mt-1 text-sm text-muted">
                  {dnssecActive
                    ? `Estado atual: ${DNSSEC_LABELS[zone.dnssec]}.`
                    : "O DNSSEC ainda não está ativado neste domínio."}
                </p>
              </div>
            </div>
            <DnssecPill status={zone.dnssec} />
          </div>

          <div className="mt-4 rounded-lg border border-line bg-ink px-4 py-3 text-sm text-muted">
            {localProvider ? (
              dnssecActive ? (
                <>
                  <span className="font-medium text-paper">Pedido registado.</span>{" "}
                  {zone.dnssec === "pending"
                    ? "O DNSSEC fica efetivo quando o provider/registrante estiver ligado. Até lá, não é seguro — mostramos o estado real."
                    : "O estado do DNSSEC deve ser confirmado junto do registrante."}
                </>
              ) : (
                <>
                  O DNSSEC protege o domínio contra respostas DNS falsificadas. Como o provider de DNS ainda não está
                  ligado, pedir a ativação apenas regista a intenção — o estado real só fica ativo depois de configurado no
                  registrante.
                </>
              )
            ) : (
              <>Gestão DNSSEC delegada ao provider {zone.provider}.</>
            )}
          </div>

          <div className="mt-4">
            {dnssecActive ? (
              <Button variant="ghost" size="sm" type="button" onClick={() => setConfirm("disable")} disabled={busy}>
                Desativar DNSSEC
              </Button>
            ) : (
              <Button variant="brand" size="sm" type="button" onClick={() => setConfirm("enable")} loading={busy}>
                Ativar DNSSEC
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <IconTile tone="muted">
              <Lock className="size-5" />
            </IconTile>
            <div>
              <h3 className="font-medium">Registrar lock</h3>
              <p className="mt-1 text-sm text-muted">
                O bloqueio de registrante impede transferências e alterações não autorizadas. Pode geri-lo no separador{" "}
                <span className="text-paper">Lock</span> do Domain Manager.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <IconTile tone={zone.status === "error" ? "muted" : "ok"}>
            <ShieldAlert className="size-5" />
          </IconTile>
          <div>
            <h3 className="font-medium">Estado da zona</h3>
            <p className="mt-1 text-sm text-muted">
              {ZONE_STATUS_LABELS[zone.status]} — provider: {zone.provider}
            </p>
          </div>
          <div className="ml-auto">
            <ZoneStatusPill status={zone.status} />
          </div>
        </div>
      </div>

      {confirm ? (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={confirm === "enable" ? "Ativar DNSSEC" : "Desativar DNSSEC"}
          description={confirm === "enable" ? `Vai pedir a ativação do DNSSEC para ${fullDomain}.` : `Vai desativar o DNSSEC de ${fullDomain}.`}
          footer={
            <>
              <Button variant="ghost" size="sm" type="button" onClick={() => setConfirm(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button variant="brand" size="sm" type="button" onClick={toggle} loading={busy}>
                {confirm === "enable" ? "Ativar DNSSEC" : "Desativar DNSSEC"}
              </Button>
            </>
          }
        >
          {confirm === "enable" && localProvider ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              Sem provider de DNS ligado, o pedido fica pendente e só fica efetivamente ativo depois de configurado junto do
              registrante. Ao contrário das plataformas que simulam, mostraremos sempre o estado real.
            </p>
          ) : (
            <p className="text-sm text-muted">
              {DNSSEC_LABELS[zone.dnssec]} → {confirm === "enable" ? "Pendente" : "Desativado"}.
            </p>
          )}
        </Modal>
      ) : null}
    </div>
  );
}