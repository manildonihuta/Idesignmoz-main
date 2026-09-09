"use client";

import { useState } from "react";

import { Modal, Button, Stepper } from "@/components/ui/core";
import type { DnsRecordInput } from "@/lib/dns/types";
import type { DnsTemplateRecord } from "@/lib/dns/templates";

export type WizardStep = {
  name: string;
  hint: string;
  records: DnsTemplateRecord[];
};

export default function DnsConfigWizard({
  title,
  description,
  steps,
  onAddRecord,
  onClose,
}: {
  title: string;
  description: string;
  steps: WizardStep[];
  onAddRecord: (input: DnsRecordInput) => Promise<{ ok: boolean; message: string }>;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  const [busyId, setBusyId] = useState<string | null>(null);

  const step = steps[current];

  async function add(index: number) {
    const record = step.records[index];
    setBusyId(`${current}-${index}`);
    const result = await onAddRecord({
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: 3600,
      priority: record.priority ?? null,
    });
    setBusyId(null);
    if (result.ok) {
      setDone((prev) => {
        const next = [...prev];
        next[current] = true;
        return next;
      });
    }
    // The records view surfaces a toast with the message.
  }

  const stepDone = done[current] || step.records.length === 0;
  const last = current === steps.length - 1;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Fechar
          </Button>
          {current > 0 ? (
            <Button variant="ghost" size="sm" type="button" onClick={() => setCurrent((c) => c - 1)}>
              Voltar
            </Button>
          ) : null}
          {!last ? (
            <Button variant="brand" size="sm" type="button" disabled={!stepDone} onClick={() => setCurrent((c) => c + 1)}>
              Continuar
            </Button>
          ) : (
            <Button variant="brand" size="sm" type="button" disabled={!stepDone} onClick={onClose}>
              Concluir
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <Stepper
          steps={steps.map((s, index) => ({
            label: s.name,
            done: done[index] || index < current,
            current: index === current,
          }))}
        />

        <div>
          <p className="text-sm font-semibold">{`Passo ${current + 1} de ${steps.length} — ${step.name}`}</p>
          <p className="mt-1 text-sm text-muted">{step.hint}</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase text-muted">
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {step.records.map((record, index) => {
                const isBusy = busyId === `${current}-${index}`;
                const added = stepDone;
                return (
                  <tr key={`${record.type}-${record.name}-${index}`} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{record.type}</span>
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-xs">{record.name}</code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[280px] text-xs break-all text-muted">{record.value}</div>
                      {record.hint ? <div className="mt-0.5 text-[11px] text-muted/70">{record.hint}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant={added ? "ok" : "brand"} size="sm" type="button" loading={isBusy} onClick={() => add(index)}>
                        {added ? "Adicionado" : "Adicionar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {stepDone ? (
          <p className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-xs text-ok">Passo concluído.{last ? "" : " Pode continuar."}</p>
        ) : null}
      </div>
    </Modal>
  );
}