"use client";

import { useEffect, useState } from "react";

import type { SiteSettings, SiteSettingsKey } from "@/lib/site-settings";

import { SectionHead, card, ActionBtn } from "./views";

type Notify = (type: "ok" | "error", text: string) => void;

export type SettingsNotify = Notify;

/* ----------------------------- Field primitives ----------------------------- */

function Field({
  label,
  hint,
  children,
  colSpan,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  colSpan?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${colSpan ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted/80">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brand";

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      className={inputCls}
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <input
      className={inputCls}
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors ${
        checked ? "border-brand/50 bg-brand/10" : "border-line bg-ink"
      }`}
    >
      <span className="text-sm font-medium text-paper">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-brand" : "bg-surface-2"}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4.5 left-0.5" : "left-0.5"
          }`}
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}

/* ----------------------------- Section editor ----------------------------- */

type EditorProps<K extends SiteSettingsKey> = {
  value: SiteSettings[K];
  onChange: (next: SiteSettings[K]) => void;
};

function GeneralEditor({ value, onChange }: EditorProps<"general">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Nome do site" colSpan>
        <TextInput value={value.siteName} onChange={(v) => set({ siteName: v })} />
      </Field>
      <Field label="Tagline" colSpan>
        <TextInput value={value.tagline} onChange={(v) => set({ tagline: v })} />
      </Field>
      <Field label="Email de apoio">
        <TextInput value={value.supportEmail} onChange={(v) => set({ supportEmail: v })} type="email" />
      </Field>
      <Field label="Telefone de apoio">
        <TextInput value={value.supportPhone} onChange={(v) => set({ supportPhone: v })} />
      </Field>
      <Field label="Morada" colSpan>
        <TextInput value={value.address} onChange={(v) => set({ address: v })} />
      </Field>
      <Field label="Cidade">
        <TextInput value={value.city} onChange={(v) => set({ city: v })} />
      </Field>
      <Field label="País">
        <TextInput value={value.country} onChange={(v) => set({ country: v })} />
      </Field>
      <Field label="Fuso horário" colSpan>
        <TextInput value={value.timezone} onChange={(v) => set({ timezone: v })} />
      </Field>
      <div className="md:col-span-2">
        <Toggle label="Modo de manutenção (só administradores vêem o site)" checked={value.maintenanceMode} onChange={(v) => set({ maintenanceMode: v })} />
      </div>
    </div>
  );
}

function BrandingEditor({ value, onChange }: EditorProps<"branding">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  const field = (k: keyof typeof value) => (
    <div className="flex items-end gap-3">
      <Field label={k} hint="Código de cor (hex)">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value[k]}
            onChange={(e) => set({ [k]: e.target.value } as Partial<typeof value>)}
            className="h-9 w-9 cursor-pointer rounded border border-line bg-ink"
          />
          <TextInput value={value[k]} onChange={(v) => set({ [k]: v } as Partial<typeof value>)} placeholder="#rrggbb" />
        </div>
      </Field>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Logótipo (URL)" colSpan hint="URL da imagem do logótipo.">
        <TextInput value={value.logoUrl} onChange={(v) => set({ logoUrl: v })} placeholder="/icon.png" />
      </Field>
      <Field label="Favicon (URL)" colSpan hint="Ícone do separador do navegador.">
        <TextInput value={value.faviconUrl} onChange={(v) => set({ faviconUrl: v })} placeholder="/icon.png" />
      </Field>
      {field("primaryColor")}
      {field("accentColor")}
      {field("backgroundColor")}
      {field("surfaceColor")}
      {field("textColor")}
      {field("inkColor")}
    </div>
  );
}

function DomainsEditor({ value, onChange }: EditorProps<"domains">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Extensão padrão" hint="Usada quando o cliente não escolhe uma ext.">
        <TextInput value={value.defaultExtension} onChange={(v) => set({ defaultExtension: v })} placeholder=".com" />
      </Field>
      <div className="md:col-span-2">
        <p className="mb-2 text-sm font-medium text-paper">Preços de registo (MT / ano)</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(value.prices).map(([ext, price]) => (
            <div key={ext} className="flex items-center gap-2">
              <span className="w-14 text-xs text-muted">.{ext}</span>
              <input
                className={inputCls}
                type="number"
                value={price}
                onChange={(e) => set({ prices: { ...value.prices, [ext]: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </div>
      <Toggle label="WHOIS ativado" checked={value.whoisEnabled} onChange={(v) => set({ whoisEnabled: v })} />
      <Toggle label="Renovação automática" checked={value.autoRenewEnabled} onChange={(v) => set({ autoRenewEnabled: v })} />
    </div>
  );
}

function HostingEditor({ value, onChange }: EditorProps<"hosting">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Plano padrão" hint="Slug do plano criado por defeito.">
        <TextInput value={value.defaultPlan} onChange={(v) => set({ defaultPlan: v })} />
      </Field>
      <Field label="Ratio de overselling">
        <NumberInput value={value.oversellRatio} onChange={(v) => set({ oversellRatio: v })} min={1} step={0.1} />
      </Field>
      <Field label="Contrato de suporte" colSpan>
        <TextInput value={value.supportContract} onChange={(v) => set({ supportContract: v })} placeholder="Ex.: 5h/mês incluídas" />
      </Field>
      <Field label="Período de tolerância (dias)" hint="Entre 'em atraso' e 'suspenso'.">
        <NumberInput value={value.billingGraceDays} onChange={(v) => set({ billingGraceDays: v })} min={1} />
      </Field>
      <Field label="Retenção de suspensão (dias)" hint="Entre 'suspenso' e 'terminado'.">
        <NumberInput value={value.billingTerminationDays} onChange={(v) => set({ billingTerminationDays: v })} min={1} />
      </Field>
      <Toggle label="Provisioning automático" checked={value.provisioningEnabled} onChange={(v) => set({ provisioningEnabled: v })} />
      <Toggle label="Backups ativados" checked={value.backupEnabled} onChange={(v) => set({ backupEnabled: v })} />
      <div className="md:col-span-2">
        <Toggle label="SSL incluído por defeito" checked={value.sslEnabled} onChange={(v) => set({ sslEnabled: v })} />
      </div>
    </div>
  );
}

function PaymentsEditor({ value, onChange }: EditorProps<"payments">) {
  const GATEWAY_LABEL: Record<string, string> = {
    mpesa: "M-Pesa",
    emola: "e-Mola",
    mkesh: "mKesh",
    visa: "Visa",
    mastercard: "Mastercard",
    "bank-transfer": "Transferência bancária",
  };
  const CURRENCIES = ["MZN", "USD", "EUR", "ZAR"];
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Moeda base" hint="Código ISO da moeda principal (MZN). USD/EUR/ZAR são suportados para o futuro.">
          <select
            className={inputCls}
            value={value.defaultCurrency ?? "MZN"}
            onChange={(e) => set({ defaultCurrency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Método padrão" hint="Selecionado por defeito no checkout.">
          <select
            className={inputCls}
            value={value.defaultMethod}
            onChange={(e) => set({ defaultMethod: e.target.value })}
          >
            {Object.keys(value.gateways).map((g) => (
              <option key={g} value={g}>{GATEWAY_LABEL[g] ?? g}</option>
            ))}
          </select>
        </Field>
        <Field label="Prefixo da fatura">
          <TextInput value={value.invoiceNumberPrefix} onChange={(v) => set({ invoiceNumberPrefix: v })} />
        </Field>
        <Field label="Rodapé da fatura" colSpan>
          <TextInput value={value.invoiceFooter} onChange={(v) => set({ invoiceFooter: v })} />
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-paper">Gateways de pagamento</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Object.entries(value.gateways).map(([id, g]) => (
            <div key={id} className="rounded-md border border-line bg-ink p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-paper">{GATEWAY_LABEL[id] ?? id}</span>
                <button type="button" onClick={() => set({ gateways: { ...value.gateways, [id]: { ...g, enabled: !g.enabled } } })}>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${g.enabled ? "bg-ok/15 text-ok" : "bg-surface-2 text-muted"}`}>
                    {g.enabled ? "Ativo" : "Inativo"}
                  </span>
                </button>
              </div>
              <label className="mb-2 flex items-center justify-between text-xs text-muted">
                Sandbox
                <input type="checkbox" checked={g.sandbox} onChange={(e) => set({ gateways: { ...value.gateways, [id]: { ...g, sandbox: e.target.checked } } })} className="accent-brand" />
              </label>
              <Field label="Taxa (fração)">
                <NumberInput value={g.feeRate ?? 0} onChange={(v) => set({ gateways: { ...value.gateways, [id]: { ...g, feeRate: v } } })} min={0} step={0.001} />
              </Field>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaxEditor({ value, onChange }: EditorProps<"tax">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Taxa de imposto (%)" hint="Ex.: 15 = 15%.">
        <NumberInput value={value.rate} onChange={(v) => set({ rate: v })} min={0} step={0.1} />
      </Field>
      <Field label="Nome do imposto">
        <TextInput value={value.taxName} onChange={(v) => set({ taxName: v })} placeholder="IVA" />
      </Field>
      <Field label="NIF da empresa" colSpan hint="Número único de identificação tributária.">
        <TextInput value={value.taxId} onChange={(v) => set({ taxId: v })} />
      </Field>
      <div className="md:col-span-2">
        <Toggle label="Imposto incluído nos preços" checked={value.includedInPrices} onChange={(v) => set({ includedInPrices: v })} />
      </div>
    </div>
  );
}

function EmailEditor({ value, onChange }: EditorProps<"email">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Nome do remetente">
        <TextInput value={value.fromName} onChange={(v) => set({ fromName: v })} />
      </Field>
      <Field label="Email do remetente">
        <TextInput value={value.fromEmail} onChange={(v) => set({ fromEmail: v })} type="email" />
      </Field>
      <Field label="Responder a">
        <TextInput value={value.replyTo} onChange={(v) => set({ replyTo: v })} type="email" />
      </Field>
      <Field label="Título do email de encomenda">
        <TextInput value={value.orderTemplateTitle} onChange={(v) => set({ orderTemplateTitle: v })} />
      </Field>
      <Field label="Título do recibo" colSpan>
        <TextInput value={value.receiptTemplateTitle} onChange={(v) => set({ receiptTemplateTitle: v })} />
      </Field>
    </div>
  );
}

function WhatsAppEditor({ value, onChange }: EditorProps<"whatsapp">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Número WhatsApp" colSpan>
        <TextInput value={value.phoneNumber} onChange={(v) => set({ phoneNumber: v })} placeholder="+258 84 000 0000" />
      </Field>
      <Field label="Mensagem padrão" colSpan>
        <TextInput value={value.defaultMessage} onChange={(v) => set({ defaultMessage: v })} placeholder="Olá! Gostaria de mais informações." />
      </Field>
      <div className="md:col-span-2">
        <Toggle label="WhatsApp ativado" checked={value.enabled} onChange={(v) => set({ enabled: v })} />
      </div>
    </div>
  );
}

function SeoEditor({ value, onChange }: EditorProps<"seo">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Modelo de título" colSpan hint="%s é substituído pelo título da página.">
        <TextInput value={value.titleTemplate} onChange={(v) => set({ titleTemplate: v })} />
      </Field>
      <Field label="Descrição padrão" colSpan>
        <TextInput value={value.defaultDescription} onChange={(v) => set({ defaultDescription: v })} />
      </Field>
      <Field label="Imagem Open Graph (URL)" colSpan>
        <TextInput value={value.ogImageUrl} onChange={(v) => set({ ogImageUrl: v })} />
      </Field>
      <Field label="Extras do robots.txt" colSpan>
        <TextInput value={value.robotsTxtExtra} onChange={(v) => set({ robotsTxtExtra: v })} />
      </Field>
      <div className="md:col-span-2">
        <Toggle label="Analytics ativado" checked={value.analyticsEnabled} onChange={(v) => set({ analyticsEnabled: v })} />
      </div>
    </div>
  );
}

function SecurityEditor({ value, onChange }: EditorProps<"security">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Pedidos / minuto (rate limit)">
        <NumberInput value={value.rateLimitRequests} onChange={(v) => set({ rateLimitRequests: v })} min={1} />
      </Field>
      <Field label="Janela (segundos)">
        <NumberInput value={value.rateLimitWindow} onChange={(v) => set({ rateLimitWindow: v })} min={1} />
      </Field>
      <Field label="Sessão expira após (horas)">
        <NumberInput value={value.sessionTimeoutHours} onChange={(v) => set({ sessionTimeoutHours: v })} min={1} />
      </Field>
      <div className="md:col-span-1" />
      <Toggle label="Exigir verificação de email no registo" checked={value.requireEmailVerification} onChange={(v) => set({ requireEmailVerification: v })} />
      <Toggle label="Permitir registo aberto" checked={value.allowRegistration} onChange={(v) => set({ allowRegistration: v })} />
    </div>
  );
}

function SmtpEditor({ value, onChange }: EditorProps<"smtp">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Servidor SMTP" colSpan>
        <TextInput value={value.host} onChange={(v) => set({ host: v })} placeholder="smtp.seudominio.com" />
      </Field>
      <Field label="Porta">
        <NumberInput value={value.port} onChange={(v) => set({ port: v })} min={1} />
      </Field>
      <Field label="Utilizador">
        <TextInput value={value.username} onChange={(v) => set({ username: v })} />
      </Field>
      <Field label="Palavra-passe" colSpan>
        <TextInput value={value.password} onChange={(v) => set({ password: v })} type="password" />
      </Field>
      <div className="md:col-span-2">
        <Toggle label="Conexão segura (TLS/SSL)" checked={value.secure} onChange={(v) => set({ secure: v })} />
      </div>
    </div>
  );
}

function IntegrationsEditor({ value, onChange }: EditorProps<"integrations">) {
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  const rows: Array<[keyof typeof value, string, boolean]> = [
    ["resendApiKey", "Chave API do Resend (email)", true],
    ["azureAppInsightsKey", "Chave do Azure Application Insights", true],
    ["vercelApiKey", "Chave API da Vercel (deploys)", true],
    ["objectStorageBucket", "Bucket de armazenamento (objetos)", false],
    ["webhookUrl", "Webhook de integração (URL)", false],
  ];
  return (
    <div className="grid grid-cols-1 gap-4">
      {rows.map(([k, label, secret]) => (
        <Field key={k} label={label}>
          <TextInput value={value[k]} onChange={(v) => set({ [k]: v } as Partial<typeof value>)} type={secret ? "password" : "text"} />
        </Field>
      ))}
    </div>
  );
}

/* ----------------------------- Editor registry ----------------------------- */

const OUTPUT_CURRENCIES = ["USD", "EUR", "ZAR"] as const;

/** Standalone editor for FX rates (MZN per unit), persisted via /api/admin/rates. */
function RatesEditPanel({ notify }: { notify: Notify }) {
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/rates", { headers: { Accept: "application/json" } });
        const data = (await res.json()) as { ok: boolean; rates?: Record<string, number> };
        if (active && data.ok && data.rates) {
          const next: Record<string, string> = {};
          for (const code of OUTPUT_CURRENCIES) {
            next[code] = data.rates[code] != null ? String(data.rates[code]) : "";
          }
          setRates(next);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      for (const code of OUTPUT_CURRENCIES) {
        const v = Number(rates[code]);
        if (Number.isFinite(v) && v > 0) payload[code] = v;
      }
      const res = await fetch("/api/admin/rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: payload }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao guardar rates.");
      notify("ok", "Taxas de câmbio guardadas.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Falha ao guardar rates.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">A carregar taxas…</p>;

  return (
    <div className="mt-8 border-t border-line pt-6">
      <SectionHead title="Taxas de câmbio (FX)" desc="Valor de 1 unidade em MZN. O Metical é a moeda principal." />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {OUTPUT_CURRENCIES.map((code) => (
          <div key={code} className="rounded-md border border-line bg-ink p-4">
            <label className="mb-1.5 block text-xs font-medium text-muted">{code} → MZN</label>
            <input
              className={inputCls}
              type="number"
              step="0.0001"
              min="0"
              value={rates[code] ?? ""}
              onChange={(e) => setRates((r) => ({ ...r, [code]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <ActionBtn tone="ok" onClick={() => void save()} busy={saving}>Guardar taxas</ActionBtn>
      </div>
    </div>
  );
}

export const SETTINGS_TABS: { id: SiteSettingsKey | "users" | "roles" | "notifications" | "api"; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "◉" },
  { id: "branding", label: "Branding", icon: "◆" },
  { id: "domains", label: "Domains", icon: "◎" },
  { id: "hosting", label: "Hosting", icon: "▣" },
  { id: "payments", label: "Payments", icon: "₹" },
  { id: "tax", label: "Tax", icon: "§" },
  { id: "email", label: "Email", icon: "✉" },
  { id: "whatsapp", label: "WhatsApp", icon: "▰" },
  { id: "seo", label: "SEO", icon: "⌕" },
  { id: "security", label: "Security", icon: "⚿" },
  { id: "smtp", label: "SMTP", icon: "⇄" },
  { id: "integrations", label: "Integrations", icon: "⧉" },
  { id: "users", label: "Users", icon: "▤" },
  { id: "roles", label: "Roles", icon: "◍" },
  { id: "notifications", label: "Notifications", icon: "❖" },
  { id: "api", label: "API", icon: "⌘" },
];

function PlaceholderCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={card}>
      <SectionHead title={title} desc={desc} />
    </div>
  );
}

type AnySection = SiteSettings[SiteSettingsKey];

function EditorShell({
  tab,
  value,
  onChange,
}: {
  tab: SiteSettingsKey;
  value: AnySection;
  onChange: (next: AnySection) => void;
}) {
  const emit = onChange as (v: never) => void;
  switch (tab) {
    case "general":
      return <GeneralEditor value={value as Parameters<typeof GeneralEditor>[0]["value"]} onChange={emit as never} />;
    case "branding":
      return <BrandingEditor value={value as Parameters<typeof BrandingEditor>[0]["value"]} onChange={emit as never} />;
    case "domains":
      return <DomainsEditor value={value as Parameters<typeof DomainsEditor>[0]["value"]} onChange={emit as never} />;
    case "hosting":
      return <HostingEditor value={value as Parameters<typeof HostingEditor>[0]["value"]} onChange={emit as never} />;
    case "payments":
      return <PaymentsEditor value={value as Parameters<typeof PaymentsEditor>[0]["value"]} onChange={emit as never} />;
    case "tax":
      return <TaxEditor value={value as Parameters<typeof TaxEditor>[0]["value"]} onChange={emit as never} />;
    case "email":
      return <EmailEditor value={value as Parameters<typeof EmailEditor>[0]["value"]} onChange={emit as never} />;
    case "whatsapp":
      return <WhatsAppEditor value={value as Parameters<typeof WhatsAppEditor>[0]["value"]} onChange={emit as never} />;
    case "seo":
      return <SeoEditor value={value as Parameters<typeof SeoEditor>[0]["value"]} onChange={emit as never} />;
    case "security":
      return <SecurityEditor value={value as Parameters<typeof SecurityEditor>[0]["value"]} onChange={emit as never} />;
    case "smtp":
      return <SmtpEditor value={value as Parameters<typeof SmtpEditor>[0]["value"]} onChange={emit as never} />;
    case "integrations":
      return <IntegrationsEditor value={value as Parameters<typeof IntegrationsEditor>[0]["value"]} onChange={emit as never} />;
    default:
      return null;
  }
}

function renderEditor(tab: SiteSettingsKey, settings: SiteSettings, onChange: (next: AnySection) => void) {
  return (
    <EditorShell tab={tab} value={settings[tab] as AnySection} onChange={onChange} />
  );
}

/* ----------------------------- Main view ----------------------------- */

export function SiteSettingsView({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]["id"]>("general");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/settings", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { ok: boolean; settings?: SiteSettings };
        if (active && data.ok && data.settings) {
          setSettings(data.settings);
          setDraft(data.settings);
        } else {
          throw new Error();
        }
      } catch {
        if (active) notify("error", "Não foi possível carregar as definições.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [notify]);

  const isMetaTab = tab === "users" || tab === "roles" || tab === "notifications" || tab === "api";

  async function save() {
    if (!draft || !settings) return;
    setSaving(true);
    try {
      const patch = { [tab]: (draft as Record<string, unknown>)[tab] };
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; settings?: SiteSettings };
      if (!res.ok || !data.ok || !data.settings) throw new Error(data.error || "Falha ao guardar.");
      setSettings(data.settings);
      setDraft(data.settings);
      notify("ok", "Definições guardadas.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Falha ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (settings) setDraft(settings);
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted">A carregar definições…</p>;
  }

  const activeTab = SETTINGS_TABS.find((t) => t.id === tab)!;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[240px_1fr]">
      <nav className="self-start rounded-xl border border-line bg-surface p-3 xl:sticky xl:top-24">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-1">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                tab === t.id ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-paper"
              }`}
            >
              <span className="text-xs">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className={card}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SectionHead title={activeTab.label} desc="Configuração da plataforma." />
          {!isMetaTab && (
            <div className="flex gap-2">
              <ActionBtn tone="ghost" onClick={reset} disabled={saving}>Repor</ActionBtn>
              <ActionBtn tone="ok" onClick={() => void save()} busy={saving}>Guardar</ActionBtn>
            </div>
          )}
        </div>

        {draft && !isMetaTab && renderEditor(tab as SiteSettingsKey, draft, (next) => setDraft({ ...draft, [tab]: next }))}

        {tab === "payments" && !isMetaTab && <RatesEditPanel notify={notify} />}

        {isMetaTab && tab === "users" && (
          <PlaceholderCard title="Utilizadores" desc="Gestão de contas e acessos — gere em 'Utilizadores' no menu principal." />
        )}
        {isMetaTab && tab === "roles" && (
          <PlaceholderCard title="Roles & Permissões" desc="Atribuição de funções (Super Admin, Admin, Manager, …) e permissões RBAC." />
        )}
        {isMetaTab && tab === "notifications" && (
          <PlaceholderCard title="Notificações" desc="Canais (email, WhatsApp) e eventos de notificação." />
        )}
        {isMetaTab && tab === "api" && (
          <PlaceholderCard title="API" desc="Chaves de API pública, webhooks e limites de acesso." />
        )}
      </div>
    </div>
  );
}