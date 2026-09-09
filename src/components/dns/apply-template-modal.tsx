"use client";

import { useState } from "react";

import { Modal, Button, Table, type Column } from "@/components/ui/core";
import type { DnsRecordInput, DnsRecordType } from "@/lib/dns/types";
import type { DnsTemplate } from "@/lib/dns/templates";

type Row = {
  type: DnsRecordType;
  name: string;
  value: string;
  priority: number | null;
  placeholder?: boolean;
  hint?: string;
};

export default function ApplyTemplateModal({
  template,
  onApply,
  onCancel,
}: {
  template: DnsTemplate;
  onApply: (records: DnsRecordInput[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    template.records.map((r) => ({
      type: r.type,
      name: r.name,
      value: r.value,
      priority: r.priority ?? null,
      placeholder: r.placeholder,
      hint: r.hint,
    })),
  );

  const setValue = (index: number, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, value } : row)));
  };

  const columns: Column<Row>[] = [
    { key: "type", header: "Tipo", render: (row) => <span className="font-mono text-xs">{row.type}</span> },
    { key: "name", header: "Nome", render: (row) => <code className="text-xs">{row.name}</code> },
    {
      key: "value",
      header: "Valor",
      render: (row, index) => (
        <input
          className="w-full min-w-[240px] rounded-lg border border-line bg-ink px-2 py-1.5 text-xs outline-none focus:border-brand"
          value={row.value}
          onChange={(event) => setValue(index, event.target.value)}
        />
      ),
    },
    {
      key: "priority",
      header: "Pri.",
      align: "right",
      render: (row) => (row.priority == null ? <span className="text-muted">—</span> : row.priority),
    },
  ];

  return (
    <Modal
      open
      onClose={onCancel}
      title="Aplicar modelo"
      description={`Configure ${template.label} — está prestes a adicionar registos DNS. Os registos existentes não são substituídos.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            size="sm"
            type="button"
            onClick={() =>
              onApply(
                rows.map((row) => ({
                  type: row.type,
                  name: row.name,
                  value: row.value,
                  ttl: 3600,
                  priority: row.priority,
                })),
              )
            }
          >
            Aplicar DNS Configuration
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Table
          columns={columns}
          rows={rows}
          rowKey={(row, index) => `${row.type}-${row.name}-${index}`}
          empty="Sem registos para aplicar."
        />
        {rows.some((row) => row.placeholder) ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Alguns valores têm marcadores de posição — confirme cada um antes de aplicar (ex. códigos de verificação, chaves
            DKIM ou IPs do seu servidor).
          </p>
        ) : null}
      </div>
    </Modal>
  );
}