import type { DnsRecordInput } from "@/lib/dns/types";

export type DnsTemplateRecord = Omit<DnsRecordInput, "ttl" | "priority"> & {
  priority?: number | null;
  placeholder?: boolean;
  hint?: string;
};

export type DnsTemplate = {
  id: string;
  label: string;
  hint: string;
  wizard?: boolean;
  records: DnsTemplateRecord[];
};

export const DNS_QUICK_SETUP_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "website", label: "Website", hint: "A + CNAME www para publicar o seu site" },
  { id: "email", label: "Email Profissional", hint: "MX + SPF + DMARC para o email do domínio" },
  { id: "google", label: "Google Workspace", hint: "Guia passo a passo para Gmail/Google" },
  { id: "microsoft", label: "Microsoft 365", hint: "Guia passo a passo para Outlook/M365" },
  { id: "external", label: "Alojamento Externo", hint: "Apontar para servidores externos" },
  { id: "custom", label: "DNS Personalizado", hint: "Criar registos manualmente" },
];

export const DNS_TEMPLATES: DnsTemplate[] = [
  {
    id: "website",
    label: "Website na IDesign Moz",
    hint: "A + CNAME www para o nosso alojamento",
    records: [
      { type: "A", name: "@", value: "149.210.210.210", priority: null },
      { type: "CNAME", name: "www", value: "proxy-ssl.idesignmoz.com", priority: null },
    ],
  },
  {
    id: "email",
    label: "Email Profissional",
    hint: "MX + SPF + DMARC (olhe para os valores antes de aplicar)",
    records: [
      { type: "MX", name: "@", value: "mail.idesignmoz.com", priority: 10 },
      { type: "TXT", name: "@", value: "v=spf1 include:idesignmoz.com ~all", priority: null },
      {
        type: "TXT",
        name: "_dmarc",
        value: "v=DMARC1; p=none; rua=mailto:dmarc@example.com",
        priority: null,
        placeholder: true,
        hint: "Substitua o email após o mailto: pelo seu email real.",
      },
      {
        type: "TXT",
        name: "default._domainkey",
        value: "v=DKIM1; k=rsa; p=",
        priority: null,
        placeholder: true,
        hint: "Preencha a chave pública após ativar o DKIM na sua caixa de email.",
      },
    ],
  },
  {
    id: "external",
    label: "Alojamento Externo",
    hint: "Registos A/CNAME para servidores fora da IDesign Moz",
    records: [
      { type: "A", name: "@", value: "111.222.333.444", priority: null, placeholder: true, hint: "Substitua pelo IP do seu servidor." },
      { type: "CNAME", name: "www", value: "seu-servidor.example.com", priority: null, placeholder: true, hint: "Substitua pelo hostname do seu servidor." },
    ],
  },
];

export const GOOGLE_WORKSPACE_STEPS = [
  { name: "Verificação de domínio", hint: "Registo TXT que o Google usa para confirmar que o domínio é seu." },
  { name: "MX", hint: "Encaminha o email para o Gmail." },
  { name: "SPF", hint: "Autoriza o Google a enviar email em seu nome." },
  { name: "DKIM", hint: "Assinatura digital do email (opcional, recomendada)." },
  { name: "Verificação final", hint: "Confirma que os passos anteriores são públicos." },
] as const;

export const GOOGLE_WORKSPACE_RECORDS: DnsTemplateRecord[] = [
  {
    type: "TXT",
    name: "@",
    value: "google-site-verification=",
    priority: null,
    placeholder: true,
    hint: "Pode copiar o valor do painel do Google Workspace.",
  },
  { type: "MX", name: "@", value: "aspmx.l.google.com", priority: 1 },
  { type: "MX", name: "@", value: "alt1.aspmx.l.google.com", priority: 5 },
  { type: "MX", name: "@", value: "alt2.aspmx.l.google.com", priority: 5 },
  { type: "MX", name: "@", value: "alt3.aspmx.l.google.com", priority: 5 },
  { type: "MX", name: "@", value: "alt4.aspmx.l.google.com", priority: 5 },
  { type: "TXT", name: "@", value: "v=spf1 include:_spf.google.com ~all", priority: null },
  {
    type: "TXT",
    name: "google._domainkey",
    value: "v=DKIM1; k=rsa; p=",
    priority: null,
    placeholder: true,
    hint: "Preencha a chave pública gerada no Google Workspace.",
  },
];

export const MICROSOFT_365_STEPS = [
  { name: "Verificação de domínio", hint: "Registo TXT que o Microsoft 365 usa para confirmar a posse." },
  { name: "MX", hint: "Encaminha o email para o Exchange Online." },
  { name: "CNAME", hint: "Autodiscover para configurar Outlook automaticamente." },
  { name: "TXT", hint: "Registo de verificação do serviço." },
  { name: "SPF", hint: "Autoriza o Microsoft 365 a enviar email em seu nome." },
  { name: "DKIM", hint: "Assinatura digital do email (recomendado)." },
] as const;

export const MICROSOFT_365_RECORDS: DnsTemplateRecord[] = [
  {
    type: "TXT",
    name: "@",
    value: "MS=ms00000000",
    priority: null,
    placeholder: true,
    hint: "Use o valor MS=… fornecido pelo centro de administração do Microsoft 365.",
  },
  {
    type: "MX",
    name: "@",
    value: "idesignmoz-com.mail.protection.outlook.com",
    priority: 0,
    placeholder: true,
    hint: "Substitua o hostname pelo da sua organização (o domínio com hífens).",
  },
  { type: "CNAME", name: "autodiscover", value: "autodiscover.outlook.com", priority: null },
  { type: "TXT", name: "@", value: "v=spf1 include:spf.protection.outlook.com ~all", priority: null },
  {
    type: "TXT",
    name: "selector1._domainkey",
    value: "v=DKIM1; k=rsa; p=",
    priority: null,
    placeholder: true,
    hint: "Preencha com a chave pública gerada no Microsoft 365.",
  },
];

export function getDnsTemplate(id: string): DnsTemplate | undefined {
  return DNS_TEMPLATES.find((t) => t.id === id);
}