"use client";

import { useState } from "react";

import type { DnsRecord, DnsRecordInput, DnsRecordType } from "@/lib/dns/types";
import { DNS_RECORD_TYPES } from "@/lib/dns/types";
import { TTL_OPTIONS } from "@/lib/dns/validation";
import { TextField, SelectField, Button } from "@/components/ui/core";

export type RecordFormValues = {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: number;
  priority: string;
  weight: string;
  port: string;
  target: string;
};

const EMPTY: RecordFormValues = {
  type: "A",
  name: "@",
  value: "",
  ttl: 3600,
  priority: "",
  weight: "10",
  port: "60",
  target: "",
};

const TYPE_HINTS: Record<DnsRecordType, string> = {
  A: "Endereço IPv4 do servidor, ex. 149.210.210.210.",
  AAAA: "Endereço IPv6 do servidor.",
  CNAME: "Aponta para outro hostname, ex. proxy-ssl.idesignmoz.com.",
  MX: "Servidor de email. Junte a prioridade (número mais baixo tem prioridade).",
  TXT: "Texto livre — usado em SPF, DKIM, DMARC e verificações.",
  NS: "Servidor de nomes autoritativo para o domínio.",
  SRV: "Serviços (sip, xmpp…). Preencha peso, porta e alvo.",
  CAA: "Autoriza emissão de certificados. Formato: flag tag valor, ex. 0 issue letsencrypt.org.",
};

function srvRecordToForm(record: DnsRecord): RecordFormValues {
  const parts = record.value.split(/\s+/);
  return {
    type: record.type,
    name: record.name,
    value: record.type === "SRV" ? "" : record.value,
    ttl: record.ttl,
    priority: record.priority == null ? "" : String(record.priority),
    weight: parts[0] ?? "10",
    port: parts[1] ?? "60",
    target: parts[2] ?? "",
  };
}

function formToInput(form: RecordFormValues): { ok: true; input: DnsRecordInput } | { ok: false; message: string } {
  let value = form.value.trim();
  if (form.type === "SRV") {
    value = `${form.weight.trim()} ${form.port.trim()} ${form.target.trim()}`;
  }
  if (!value) return { ok: false, message: "Indique o valor do registo." };
  return {
    ok: true,
    input: {
      type: form.type,
      name: form.name.trim() || "@",
      value,
      ttl: form.ttl,
      priority: form.priority === "" ? null : Number(form.priority),
    },
  };
}

export default function DnsRecordForm({
  mode,
  record,
  busy,
  onSave,
  onCancel,
}: {
  mode: "create" | "update";
  record?: DnsRecord | null;
  busy: boolean;
  onSave: (input: DnsRecordInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<RecordFormValues>(() =>
    mode === "update" && record ? srvRecordToForm(record) : { ...EMPTY, type: record?.type ?? "A" },
  );

  const set = <K extends keyof RecordFormValues>(key: K, value: RecordFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isSrv = form.type === "SRV";
  const needsPriority = form.type === "MX" || form.type === "SRV";

  function submit() {
    const parsed = formToInput(form);
    if (!parsed.ok) {
      // The form guarantees a value for SRV; still guard for safety.
      return;
    }
    onSave(parsed.input);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Tipo"
          size="sm"
          value={form.type}
          onChange={(event) => set("type", event.target.value as DnsRecordType)}
          options={DNS_RECORD_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <TextField
          label="Nome"
          size="sm"
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
          hint={form.type === "SRV" ? "ex. _sip._tls" : "use @ para a raiz, ex. @ ou www"}
        />
      </div>

      {isSrv ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField label="Peso" size="sm" value={form.weight} onChange={(event) => set("weight", event.target.value)} />
          <TextField label="Porta" size="sm" value={form.port} onChange={(event) => set("port", event.target.value)} />
          <TextField label="Alvo" size="sm" value={form.target} onChange={(event) => set("target", event.target.value)} placeholder="ex. sip.idesignmoz.com" />
        </div>
      ) : (
        <TextField
          label="Valor"
          size="sm"
          value={form.value}
          onChange={(event) => set("value", event.target.value)}
          hint={TYPE_HINTS[form.type]}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="TTL"
          size="sm"
          value={String(form.ttl)}
          onChange={(event) => set("ttl", Number(event.target.value))}
          options={TTL_OPTIONS.map((t) => ({
            value: t.value === "auto" ? "3600" : String(t.value),
            label: t.value === "auto" ? "Auto (recomendado)" : t.label,
          }))}
        />
        {needsPriority ? (
          <TextField
            label="Prioridade"
            size="sm"
            type="number"
            value={form.priority}
            onChange={(event) => set("priority", event.target.value)}
            hint={form.type === "MX" ? "ex. 10 (menor = maior prioridade)" : "prioridade do SRV (0–65535)"}
          />
        ) : (
          <div />
        )}
      </div>

      <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">{TYPE_HINTS[form.type]}</p>

      <div className="flex items-center justify-end gap-3 pt-1">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="brand" size="sm" type="button" onClick={submit} loading={busy}>
          {mode === "create" ? "Criar registo" : "Guardar alterações"}
        </Button>
      </div>
    </div>
  );
}