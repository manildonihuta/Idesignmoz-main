"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";

import {
  Button,
  EmptyState,
  Modal,
  StatusBadge,
  Table,
  useToast,
  type Column,
} from "@/components/ui/core";
import type { DnsBundle, DnsRecord, DnsRecordInput } from "@/lib/dns/types";
import { DNS_QUICK_SETUP_OPTIONS, getDnsTemplate, type DnsTemplate } from "@/lib/dns/templates";
import {
  GOOGLE_WORKSPACE_RECORDS,
  GOOGLE_WORKSPACE_STEPS,
  MICROSOFT_365_RECORDS,
  MICROSOFT_365_STEPS,
} from "@/lib/dns/templates";
import { dnsApi } from "@/lib/dns/client-api";
import { useDnsBundle, fmtValue } from "@/components/dns/dns-shared";
import DnsRecordForm from "@/components/dns/record-form";
import ApplyTemplateModal from "@/components/dns/apply-template-modal";
import DnsConfigWizard, { type WizardStep } from "@/components/dns/dns-config-wizard";
import PropagationModal, { type PropagationState } from "@/components/dns/dns-propagation-modal";

type FormState = { mode: "create" | "update"; record: DnsRecord | null } | null;

export default function DnsRecordsView({ fullDomain, initialBundle }: { fullDomain: string; initialBundle: DnsBundle }) {
  const { bundle, setBundle } = useDnsBundle(fullDomain, initialBundle);
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DnsRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [template, setTemplate] = useState<DnsTemplate | null>(null);
  const [wizard, setWizard] = useState<{ title: string; description: string; steps: WizardStep[] } | null>(null);
  const [propagation, setPropagation] = useState<PropagationState>({ state: "idle", checks: [] });

  const records = bundle.records;

  const googleWizard = useMemo(() => {
    return {
      title: "Google Workspace",
      description: "Guia passo a passo para ligar o email ao Gmail do Google Workspace.",
      steps: GOOGLE_WORKSPACE_STEPS.map((step, index): WizardStep => {
        let stepRecords: WizardStep["records"] = [];
        if (index === 0) stepRecords = [GOOGLE_WORKSPACE_RECORDS[0]];
        if (index === 1) stepRecords = GOOGLE_WORKSPACE_RECORDS.slice(1, 6);
        if (index === 2) stepRecords = [GOOGLE_WORKSPACE_RECORDS[6]];
        if (index === 3) stepRecords = [GOOGLE_WORKSPACE_RECORDS[7]];
        return { name: step.name, hint: step.hint, records: stepRecords };
      }),
    };
  }, []);

  const microsoftWizard = useMemo(() => {
    return {
      title: "Microsoft 365",
      description: "Guia passo a passo para ligar o email ao Microsoft 365 / Outlook.",
      steps: MICROSOFT_365_STEPS.map((step, index): WizardStep => {
        let stepRecords: WizardStep["records"] = [];
        if (index === 0) stepRecords = [MICROSOFT_365_RECORDS[0]];
        if (index === 1) stepRecords = [MICROSOFT_365_RECORDS[1]];
        if (index === 2) stepRecords = [MICROSOFT_365_RECORDS[2]];
        if (index === 4) stepRecords = [MICROSOFT_365_RECORDS[3]];
        if (index === 5) stepRecords = [MICROSOFT_365_RECORDS[4]];
        return { name: step.name, hint: step.hint, records: stepRecords };
      }),
    };
  }, []);

  function openQuickSetup(id: string) {
    if (id === "custom") {
      setForm({ mode: "create", record: null });
      return;
    }
    if (id === "google") {
      setWizard(googleWizard);
      return;
    }
    if (id === "microsoft") {
      setWizard(microsoftWizard);
      return;
    }
    const found = getDnsTemplate(id);
    if (found) setTemplate(found);
  }

  async function saveRecord(input: DnsRecordInput) {
    setSaving(true);
    try {
      if (form?.mode === "update" && form.record) {
        const result = await dnsApi.updateRecord(fullDomain, form.record.id, input);
        setBundle(result.bundle);
        toast("ok", "DNS record updated successfully.");
      } else {
        const result = await dnsApi.createRecord(fullDomain, input);
        setBundle(result.bundle);
        toast("ok", "DNS record created successfully.");
      }
      setForm(null);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Erro ao guardar o registo.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await dnsApi.deleteRecord(fullDomain, deleteTarget.id);
      setBundle(result.bundle);
      toast("ok", "DNS record deleted successfully.");
      setDeleteTarget(null);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Erro ao remover o registo.");
    } finally {
      setDeleting(false);
    }
  }

  async function applyTemplateRecords(recordsInput: DnsRecordInput[]) {
    if (applying) return;
    setApplying(true);
    try {
      let added = 0;
      let skipped = 0;
      for (const input of recordsInput) {
        const key = `${input.type}|${input.name.toLowerCase()}|${input.value}`;
        if (records.some((r) => `${r.type}|${r.name.toLowerCase()}|${r.value}` === key)) {
          skipped += 1;
          continue;
        }
        const result = await dnsApi.createRecord(fullDomain, input);
        added += 1;
        if (result.bundle) setBundle(result.bundle);
      }
      toast("ok", `Modelo aplicado · ${added} registos adicionados${skipped ? `, ${skipped} já existiam` : ""}.`);
      setTemplate(null);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Erro ao aplicar o modelo.");
    } finally {
      setApplying(false);
    }
  }

  async function wizardAddRecord(input: DnsRecordInput): Promise<{ ok: boolean; message: string }> {
    const key = `${input.type}|${input.name.toLowerCase()}|${input.value}`;
    if (records.some((r) => `${r.type}|${r.name.toLowerCase()}|${r.value}` === key)) {
      return { ok: true, message: "Registo já existente." };
    }
    try {
      const result = await dnsApi.createRecord(fullDomain, input);
      setBundle(result.bundle);
      toast("ok", "DNS record created successfully.");
      return { ok: true, message: "Registo criado." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar o registo.";
      toast("error", message);
      return { ok: false, message };
    }
  }

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

  const columns: Column<DnsRecord>[] = [
    {
      key: "type",
      header: "Tipo",
      render: (row) => <span className="font-mono text-xs">{row.type}</span>,
    },
    { key: "name", header: "Nome", render: (row) => <code className="text-xs">{row.name}</code> },
    {
      key: "value",
      header: "Valor",
      render: (row) => <span className="block max-w-[280px] break-all text-xs text-muted">{fmtValue(row.value)}</span>,
    },
    { key: "ttl", header: "TTL", align: "right", render: (row) => <span className="text-xs text-muted">{row.ttl}</span> },
    {
      key: "priority",
      header: "Pri.",
      align: "right",
      render: (row) => (row.priority == null ? <span className="text-muted">—</span> : <span className="text-xs">{row.priority}</span>),
    },
    {
      key: "actions",
      header: "Ações",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-paper"
            onClick={() => setForm({ mode: "update", record: row })}
            aria-label="Editar registo"
            title="Editar"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-400"
            onClick={() => setDeleteTarget(row)}
            aria-label="Remover registo"
            title="Remover"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display-2 text-lg font-semibold tracking-tight">DNS Records</h2>
          <p className="text-sm text-muted">
            {records.length} registos para <span className="text-paper">@{fullDomain}</span>. Use &ldquo;@&rdquo; para a raiz.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" size="sm" type="button" onClick={() => setForm({ mode: "create", record: null })}>
            <Plus className="mr-1.5 size-4" />
            Novo registo
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={runPropagation}>
            <RefreshCw className="mr-1.5 size-4" />
            Verificar propagação
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        rows={records}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            compact
            title="Sem registos DNS"
            description="Adicione registos manualmente ou use um dos modelos de configuração rápida."
            action={{ label: "Adicionar registo", onClick: () => setForm({ mode: "create", record: null }) }}
          />
        }
      />

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Wand2 className="size-4 text-brand" />
          <h3 className="text-sm font-semibold">Configuração rápida</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {DNS_QUICK_SETUP_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="rounded-lg border border-line bg-ink p-4 text-left hover:border-brand"
              onClick={() => openQuickSetup(option.id)}
            >
              <p className="text-sm font-semibold">{option.label}</p>
              <p className="mt-1 text-xs text-muted">{option.hint}</p>
              <span className="mt-3 inline-block text-xs font-semibold text-brand">
                {option.id === "google" || option.id === "microsoft" ? "Abrir guia ↗" : "Configurar ↗"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {form ? (
        <Modal
          open
          onClose={() => setForm(null)}
          title={form.mode === "create" ? "Novo registo DNS" : "Editar registo DNS"}
          description={`Registo para @${fullDomain}`}
        >
          <DnsRecordForm
            mode={form.mode}
            record={form.record}
            busy={saving}
            onSave={saveRecord}
            onCancel={() => setForm(null)}
          />
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title="Eliminar registo DNS"
          description={`Vai remover definitivamente ${deleteTarget.type} ${deleteTarget.name} → ${fullDomain}.`}
          footer={
            <>
              <Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="brand" size="sm" type="button" onClick={confirmDelete} loading={deleting}>
                Delete Record
              </Button>
            </>
          }
        >
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            Esta alteração pode afectar o funcionamento do seu website ou serviço de email.
          </p>
        </Modal>
      ) : null}

      {template ? (
        <ApplyTemplateModal
          template={template}
          onApply={applyTemplateRecords}
          onCancel={() => setTemplate(null)}
        />
      ) : null}

      {wizard ? (
        <DnsConfigWizard
          title={wizard.title}
          description={wizard.description}
          steps={wizard.steps}
          onAddRecord={wizardAddRecord}
          onClose={() => setWizard(null)}
        />
      ) : null}

      <PropagationModal fullDomain={fullDomain} state={propagation} onRetry={runPropagation} onClose={() => setPropagation({ state: "idle", checks: [] })} />

      <div className="flex items-center gap-2 text-xs text-muted">
        <StatusBadge tone="muted">{bundle.zone.provider === "local" ? "Provider não ligado — configuração manual" : `Provider: ${bundle.zone.provider}`}</StatusBadge>
      </div>
    </div>
  );
}