"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type {
  ClientDomain,
  ContactCard,
  DnsRecord,
  DomainContacts,
  Nameservers,
} from "@/lib/domain-manager";

type Notice = { kind: "success" | "error"; text: string } | null;

type MutatePayload = {
  update?: Record<string, unknown>;
  action?: "renew" | "requestTransfer";
  extraYears?: number;
};

const DNS_TYPE_OPTIONS = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "CAA"];

const TABS = [
  "Overview",
  "DNS Management",
  "DNS Records",
  "Nameservers",
  "WHOIS",
  "Lock",
  "Transfer",
  "Renewal",
  "Auto-renew",
  "Contacts",
] as const;

type Tab = (typeof TABS)[number];

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMT(value?: number | null): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("pt-MZ").format(value)} MT`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  registered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  reserved: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  available: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  expired: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  transferred: "bg-violet-500/10 text-violet-400 border-violet-500/30",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-surface-2 text-muted border-line";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${style}`}>
      {status}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SaveBar({ onSave, busy }: { onSave: () => void; busy: boolean }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button className="button button-small" type="button" onClick={onSave} disabled={busy}>
        {busy ? "Guardando…" : "Guardar alterações"}
      </button>
    </div>
  );
}

function DnsRecordsTab({ domain, onMutate, busy }: { domain: ClientDomain; onMutate: (p: MutatePayload) => void; busy: boolean }) {
  const [records, setRecords] = useState<DnsRecord[]>(() => domain.settings.dns);
  const [type, setType] = useState("A");
  const [name, setName] = useState("");

  function addRecord(inputs?: Partial<DnsRecord>) {
    setName("");
    setRecords((prev) => [...prev, { id: crypto.randomUUID(), type: "A", name: "@", value: "", ttl: 3600, priority: "", ...inputs }]);
  }

  function removeRecord(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRecord(id: string, field: keyof DnsRecord, raw: string | number) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: raw } : r)));
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Crie e edite registos DNS para <span className="text-paper">@{domain.fullDomain}</span>.
        Use &ldquo;@&rdquo; para a raiz do domínio e &ldquo;www&rdquo; para o subdomínio www.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Tipo</span>
          <select
            className="rounded-lg border border-line bg-ink px-2 py-2 text-sm outline-none focus:border-brand"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {DNS_TYPE_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Nome</span>
          <input
            className="rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
            placeholder="ex. @, www, mail"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          className="button button-small"
          type="button"
          onClick={() => addRecord({ type: type as DnsRecord["type"], name: name.trim() || "@" })}
        >
          + Novo registo
        </button>
      </div>

      {records.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          Sem registos DNS ainda.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase text-muted">
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Nome</th>
                <th className="py-2 pr-3 font-medium">Valor</th>
                <th className="py-2 pr-3 font-medium">TTL</th>
                <th className="py-2 pr-3 font-medium">Prioridade</th>
                <th className="py-2 text-right font-medium">Remover</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    <select
                      className="w-20 rounded border border-line bg-ink px-1 py-1 text-xs outline-none focus:border-brand"
                      value={record.type}
                      onChange={(event) => updateRecord(record.id, "type", event.target.value)}
                    >
                      {DNS_TYPE_OPTIONS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-full rounded border border-line bg-ink px-2 py-1 text-xs outline-none focus:border-brand"
                      value={record.name}
                      onChange={(event) => updateRecord(record.id, "name", event.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-full rounded border border-line bg-ink px-2 py-1 text-xs outline-none focus:border-brand"
                      value={record.value}
                      onChange={(event) => updateRecord(record.id, "value", event.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-20 rounded border border-line bg-ink px-2 py-1 text-xs outline-none focus:border-brand"
                      value={record.ttl === "" ? "" : record.ttl}
                      onChange={(event) =>
                        updateRecord(record.id, "ttl", event.target.value === "" ? "" : Number(event.target.value))
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-16 rounded border border-line bg-ink px-2 py-1 text-xs outline-none focus:border-brand"
                      value={record.priority === "" ? "" : record.priority}
                      onChange={(event) =>
                        updateRecord(record.id, "priority", event.target.value === "" ? "" : Number(event.target.value))
                      }
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-xs text-rose-400 hover:opacity-80" type="button" onClick={() => removeRecord(record.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <SaveBar busy={busy} onSave={() => onMutate({ update: { dns: records } })} />
      </div>
    </div>
  );
}

const PRESETS: Array<{ label: string; hint: string; records: Array<Omit<DnsRecord, "id">> }> = [
  {
    label: "Google Workspace / Gmail",
    hint: "MX + CNAME + SPF para o Google",
    records: [
      { type: "MX", name: "@", value: "ASPMX.L.GOOGLE.COM", priority: 1, ttl: 3600 },
      { type: "MX", name: "@", value: "ALT1.ASPMX.L.GOOGLE.COM", priority: 5, ttl: 3600 },
      { type: "MX", name: "@", value: "ALT2.ASPMX.L.GOOGLE.COM", priority: 5, ttl: 3600 },
      { type: "CNAME", name: "www", value: "ghs.googlehosted.com", priority: "", ttl: 3600 },
      { type: "TXT", name: "@", value: "v=spf1 include:_spf.google.com ~all", priority: "", ttl: 3600 },
    ],
  },
  {
    label: "Website na IDesign Moz",
    hint: "A + CNAME www para o nosso alojamento",
    records: [
      { type: "A", name: "@", value: "149.210.210.210", priority: "", ttl: 3600 },
      { type: "CNAME", name: "www", value: "proxy-ssl.idesignmoz.com", priority: "", ttl: 3600 },
    ],
  },
  {
    label: "Email com Zoho",
    hint: "MX + SPF para Zoho Mail",
    records: [
      { type: "MX", name: "@", value: "mx.zoho.eu", priority: 10, ttl: 3600 },
      { type: "TXT", name: "@", value: "v=spf1 include:zoho.eu ~all", priority: "", ttl: 3600 },
    ],
  },
];

function DnsManagementTab({
  domain,
  onMutate,
  busy,
  onOpenRecords,
}: {
  domain: ClientDomain;
  onMutate: (p: MutatePayload) => void;
  busy: boolean;
  onOpenRecords: () => void;
}) {
  const [records, setRecords] = useState<DnsRecord[]>(() => domain.settings.dns);

  function applyPreset(index: number) {
    const preset = PRESETS[index];
    const base = preset.label.length;
    const existing = new Set(records.map((r) => `${r.type}|${r.name}|${r.value}`));
    const additions = preset.records
      .filter((r) => !existing.has(`${r.type}|${r.name}|${r.value}`))
      .map((r, i) => ({ ...r, id: `preset-${base}-${i}` }));
    if (additions.length > 0) {
      const next = [...records, ...additions];
      setRecords(next);
      onMutate({ update: { dns: next } });
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Um resumo da configuração DNS atual de <span className="text-paper">{domain.fullDomain}</span> e atalhos para começar.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-line bg-ink p-4">
          <p className="text-xs uppercase text-muted">Registos DNS</p>
          <p className="mt-1 text-lg font-semibold">{records.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-ink p-4">
          <p className="text-xs uppercase text-muted">Mail (MX)</p>
          <p className="mt-1 text-lg font-semibold text-emerald-400">{records.filter((r) => r.type === "MX").length}</p>
        </div>
        <div className="rounded-lg border border-line bg-ink p-4">
          <p className="text-xs uppercase text-muted">Security (TXT/SPF)</p>
          <p className="mt-1 text-lg font-semibold text-sky-400">{records.filter((r) => r.type === "TXT").length}</p>
        </div>
      </div>

      <h3 className="mt-6 mb-2 text-sm font-semibold">Presets rápidos</h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {PRESETS.map((preset, index) => (
          <button
            key={preset.label}
            type="button"
            disabled={busy}
            className="rounded-lg border border-line bg-ink p-4 text-left hover:border-brand"
            onClick={() => applyPreset(index)}
          >
            <p className="text-sm font-semibold">{preset.label}</p>
            <p className="mt-1 text-xs text-muted">{preset.hint}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-brand">Aplicar preset ↗</span>
          </button>
        ))}
      </div>

      <button className="text-link mt-6" type="button" onClick={onOpenRecords}>
        Abrir editor completo de registos DNS ↗
      </button>
    </div>
  );
}

function NameserversTab({ domain, onMutate, busy }: { domain: ClientDomain; onMutate: (p: MutatePayload) => void; busy: boolean }) {
  const [ns, setNs] = useState<Nameservers>(() => domain.settings.nameservers);

  function set(key: keyof Nameservers, value: string) {
    setNs((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Servidores de nomes (nameservers) para onde este domínio aponta. Necessários para ligar o
        domínio ao seu website e email.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(["ns1", "ns2", "ns3", "ns4"] as const).map((key) => (
          <Field key={key} label={key.toUpperCase()} value={ns[key] ?? ""} onChange={(value) => set(key, value)} />
        ))}
      </div>
      <SaveBar busy={busy} onSave={() => onMutate({ update: { nameservers: ns } })} />
    </div>
  );
}

type WhoisData = {
  registrar?: string | null;
  registrationDate?: string | null;
  expirationDate?: string | null;
  lastChanged?: string | null;
  status?: string[];
  externalUrl?: string;
};

function WhoisTab({ domain }: { domain: ClientDomain }) {
  const [loading, setLoading] = useState(true);
  const [whois, setWhois] = useState<WhoisData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/domains/whois?domain=${encodeURIComponent(domain.fullDomain)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setWhois(data.ok ? data.whois : null);
      })
      .catch(() => {
        if (!cancelled) setWhois(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain.fullDomain]);

  if (loading) {
    return <p className="text-sm text-muted">A consultar WHOIS…</p>;
  }

  const rows: Array<[string, string | undefined]> = [
    ["Domínio", domain.fullDomain],
    ["Registrar", whois?.registrar ?? undefined],
    ["Registado em", whois?.registrationDate ? fmtDate(whois.registrationDate) : domain.createdAt ? fmtDate(domain.createdAt) : undefined],
    ["Expira em", whois?.expirationDate ? fmtDate(whois.expirationDate) : domain.expiresAt ? fmtDate(domain.expiresAt) : undefined],
    ["Última alteração", whois?.lastChanged ? fmtDate(whois.lastChanged) : undefined],
    ["Estado", whois?.status?.length ? whois.status.join(", ") : domain.status],
  ];

  return (
    <div>
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase text-muted">{label}</dt>
            <dd className="mt-1 text-sm break-all text-paper">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {whois?.externalUrl ? (
        <a
          className="mt-4 inline-block text-sm text-brand hover:underline"
          href={whois.externalUrl}
          target="_blank"
          rel="noreferrer"
        >
          Ver WHOIS completo ↗
        </a>
      ) : null}
    </div>
  );
}

function LockTab({ domain, onMutate, busy }: { domain: ClientDomain; onMutate: (p: MutatePayload) => void; busy: boolean }) {
  const locked = domain.settings.lock;
  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-ink p-4">
        <div>
          <p className="font-medium">Registrar lock</p>
          <p className="mt-1 text-sm text-muted">
            {locked
              ? "O domínio está protegido contra transferências e alterações não autorizadas."
              : "O domínio pode ser transferido ou alterado. Recomendamos manter bloqueado."}
          </p>
        </div>
        <button
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
            locked ? "bg-surface-2 text-paper" : "bg-brand text-ink"
          }`}
          type="button"
          disabled={busy}
          onClick={() => onMutate({ update: { lock: !locked } })}
        >
          {locked ? "Bloqueado" : "Desbloquear"}
        </button>
      </div>
    </div>
  );
}

function TransferTab({ domain, onMutate, busy }: { domain: ClientDomain; onMutate: (p: MutatePayload) => void; busy: boolean }) {
  const [copied, setCopied] = useState(false);
  const enabled = domain.settings.transferEnabled;
  const authCode = domain.settings.transferAuthCode;

  function copyCode() {
    if (!authCode) return;
    navigator.clipboard?.writeText(authCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="rounded-lg border border-line bg-ink p-4">
        <p className="font-medium">Transferência de domínio</p>
        <p className="mt-1 text-sm text-muted">
          {enabled
            ? "A transferência está habilitada. Partilhe o código EPP/autorização com o novo registrante para completar a transferência."
            : "Um domínio com lock ativo não pode ser transferido. Desbloqueie primeiro e peça o código de autorização para transferir para outro registrante."}
        </p>

        {enabled && authCode ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-line bg-surface-2 px-4 py-2 text-base tracking-widest">
              {authCode}
            </code>
            <button className="outline-button button-small" type="button" onClick={copyCode}>
              {copied ? "Copiado ✓" : "Copiar código"}
            </button>
          </div>
        ) : null}

        <button
          className="button button-small mt-4"
          type="button"
          disabled={busy || enabled}
          onClick={() => onMutate({ action: "requestTransfer" })}
        >
          {enabled ? "Transferência habilitada" : "Pedir código de transferência"}
        </button>
      </div>
    </div>
  );
}

function RenewalTab({ domain, onMutate, busy }: { domain: ClientDomain; onMutate: (p: MutatePayload) => void; busy: boolean }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-ink p-4">
          <p className="text-xs uppercase text-muted">Expira em</p>
          <p className="mt-1 text-lg font-semibold">{fmtDate(domain.expiresAt)}</p>
        </div>
        <div className="rounded-lg border border-line bg-ink p-4">
          <p className="text-xs uppercase text-muted">Preço de renovação</p>
          <p className="mt-1 text-lg font-semibold">
            {fmtMT(domain.price)} <span className="text-xs text-muted">/ ano</span>
          </p>
        </div>
      </div>
      <button
        className="button button-small mt-4"
        type="button"
        disabled={busy}
        onClick={() => onMutate({ action: "renew", extraYears: 1 })}
      >
        Renovar por +1 ano
      </button>
      <p className="mt-4 text-sm text-muted">
        {domain.settings.autoRenew
          ? "A renovação automática está ligada — o domínio renova antes de expirar."
          : "A renovação automática está desligada. Veja o separador Auto-renew para a ligar."}
      </p>
    </div>
  );
}

function AutoRenewTab({ domain, onMutate, busy }: { domain: ClientDomain; onMutate: (p: MutatePayload) => void; busy: boolean }) {
  const autoRenew = domain.settings.autoRenew;
  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-ink p-4">
        <div>
          <p className="font-medium">Renovação automática</p>
          <p className="mt-1 text-sm text-muted">
            {autoRenew
              ? "O domínio renova automaticamente antes de expirar, sem interrupção de serviço."
              : "Renovação automática desligada — pode renovar manualmente no separador Renewal."}
          </p>
        </div>
        <button
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
            autoRenew ? "bg-surface-2 text-paper" : "bg-brand text-ink"
          }`}
          type="button"
          disabled={busy}
          onClick={() => onMutate({ update: { autoRenew: !autoRenew } })}
        >
          {autoRenew ? "Automática ligada" : "Ligar automática"}
        </button>
      </div>
    </div>
  );
}

const CONTACT_ROLES: Array<{ key: keyof DomainContacts; label: string }> = [
  { key: "registrant", label: "Registante" },
  { key: "admin", label: "Administrativo" },
  { key: "technical", label: "Técnico" },
  { key: "billing", label: "Facturação" },
];

const CONTACT_FIELDS: Array<{ key: keyof ContactCard; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "org", label: "Organização" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "address", label: "Morada" },
  { key: "city", label: "Cidade" },
  { key: "country", label: "País" },
];

function ContactsTab({ domain, onMutate, busy }: { domain: ClientDomain; onMutate: (p: MutatePayload) => void; busy: boolean }) {
  const [contacts, setContacts] = useState<DomainContacts>(() => domain.settings.contacts);

  function setField(role: keyof DomainContacts, field: keyof ContactCard, value: string) {
    setContacts((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? {}), [field]: value },
    }));
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Os dados de contacto associados ao seu domínio, usados no WHOIS e nas renovações.
      </p>
      {CONTACT_ROLES.map(({ key, label }) => {
        const card = contacts[key] ?? {};
        return (
          <details key={key} className="mb-3 rounded-lg border border-line bg-ink" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{label}</summary>
            <div className="grid grid-cols-1 gap-3 border-t border-line p-4 md:grid-cols-2">
              {CONTACT_FIELDS.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  value={card[field.key] ?? ""}
                  onChange={(value) => setField(key, field.key, value)}
                />
              ))}
            </div>
          </details>
        );
      })}
      <SaveBar busy={busy} onSave={() => onMutate({ update: { contacts } })} />
    </div>
  );
}

export default function DomainManager({ domains: initial }: { domains: ClientDomain[] }) {
  const [domains, setDomains] = useState<ClientDomain[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const domain = domains.find((d) => d.fullDomain === selected) ?? null;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function flash(next: Notice) {
    setNotice(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setNotice(null), 3500);
  }

  async function mutate(payload: MutatePayload) {
    if (!domain) return;
    setBusy(true);
    try {
      const res = await fetch("/api/client/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullDomain: domain.fullDomain, ...payload }),
      });
      const data = await res.json();
      if (res.ok && data.domain) {
        setDomains((prev) => prev.map((d) => (d.fullDomain === domain.fullDomain ? data.domain : d)));
        flash({ kind: "success", text: data.actionNote ?? "Guardado com sucesso." });
      } else {
        flash({ kind: "error", text: data.error ?? "Erro ao guardar." });
      }
    } catch {
      flash({ kind: "error", text: "Erro de rede ao guardar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">Domain Manager</h1>
        <p className="text-muted">Os seus domínios, DNS, transferências e renovações num só painel.</p>
      </div>

      {notice ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-rose-500/30 bg-rose-500/10 text-rose-400"
          }`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      ) : null}

      {domains.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-sm text-muted">Não encontrámos domínios ligados à sua conta ainda.</p>
          <Link className="button mt-5 inline-block" href="/domains">
            Registar um domínio ↗
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase text-muted">
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">Auto Renewal</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr
                    key={d.fullDomain}
                    className={`cursor-pointer border-b border-line/60 transition-colors last:border-0 ${
                      selected === d.fullDomain ? "bg-surface-2 text-paper" : "hover:bg-surface"
                    }`}
                    onClick={() => {
                      setSelected(d.fullDomain);
                      setTab("Overview");
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.fullDomain}</div>
                      <div className="text-xs text-muted">Registado em {fmtDate(d.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3">{fmtDate(d.expiresAt)}</td>
                    <td className="px-4 py-3">
                      {d.autoRenew ? (
                        <span className="text-emerald-400">Ligada</span>
                      ) : (
                        <span className="text-muted">Desligada</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-xs font-semibold text-brand hover:underline"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(d.fullDomain);
                          setTab("Overview");
                        }}
                      >
                        Gerir ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {domain ? (
            <div className="rounded-xl border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display-2 text-lg font-semibold tracking-tight">{domain.fullDomain}</h2>
                  <StatusBadge status={domain.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="button button-small"
                    type="button"
                    disabled={busy}
                    onClick={() => mutate({ action: "renew", extraYears: 1 })}
                  >
                    {busy ? "A renovar…" : "Renovar +1 ano"}
                  </button>
                  <button
                    className={`outline-button button-small ${domain.settings.lock ? "text-emerald-400" : ""}`}
                    type="button"
                    disabled={busy}
                    onClick={() => mutate({ update: { lock: !domain.settings.lock } })}
                  >
                    {domain.settings.lock ? "Lock activo" : "Unlocked"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="flex gap-1 border-b border-line px-3 pt-3">
                  {TABS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm ${
                        tab === t
                          ? "border border-b-0 border-line bg-ink text-paper"
                          : "text-muted hover:text-paper"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5">
                {tab === "Overview" ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-line bg-ink p-4">
                      <p className="text-xs uppercase text-muted">Status</p>
                      <p className="mt-1 text-lg font-semibold capitalize">{domain.status}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-ink p-4">
                      <p className="text-xs uppercase text-muted">Expira em</p>
                      <p className="mt-1 text-lg font-semibold">{fmtDate(domain.expiresAt)}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-ink p-4">
                      <p className="text-xs uppercase text-muted">Preço de renovação</p>
                      <p className="mt-1 text-lg font-semibold">{fmtMT(domain.price)}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-ink p-4 md:col-span-3">
                      <p className="text-xs uppercase text-muted">Nameservers</p>
                      <p className="mt-1 text-sm text-paper">
                        {domain.settings.nameservers.ns1} · {domain.settings.nameservers.ns2}
                      </p>
                    </div>
                  </div>
                ) : null}
                {tab === "DNS Management" ? (
                  <DnsManagementTab
                    key={domain.fullDomain}
                    domain={domain}
                    onMutate={mutate}
                    busy={busy}
                    onOpenRecords={() => setTab("DNS Records")}
                  />
                ) : null}
                {tab === "DNS Records" ? (
                  <DnsRecordsTab key={domain.fullDomain} domain={domain} onMutate={mutate} busy={busy} />
                ) : null}
                {tab === "Nameservers" ? (
                  <NameserversTab key={domain.fullDomain} domain={domain} onMutate={mutate} busy={busy} />
                ) : null}
                {tab === "WHOIS" ? <WhoisTab key={domain.fullDomain} domain={domain} /> : null}
                {tab === "Lock" ? <LockTab key={domain.fullDomain} domain={domain} onMutate={mutate} busy={busy} /> : null}
                {tab === "Transfer" ? <TransferTab key={domain.fullDomain} domain={domain} onMutate={mutate} busy={busy} /> : null}
                {tab === "Renewal" ? <RenewalTab key={domain.fullDomain} domain={domain} onMutate={mutate} busy={busy} /> : null}
                {tab === "Auto-renew" ? <AutoRenewTab key={domain.fullDomain} domain={domain} onMutate={mutate} busy={busy} /> : null}
                {tab === "Contacts" ? <ContactsTab key={domain.fullDomain} domain={domain} onMutate={mutate} busy={busy} /> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}