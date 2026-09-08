import { fmtMT } from "@/lib/invoices";
import type { CompanyInfo } from "@/lib/site-settings";

export type ProposalServiceKey =
  | "website"
  | "hosting"
  | "domain"
  | "seo"
  | "marketing"
  | "maintenance";

export type ProposalLine = {
  key: ProposalServiceKey;
  label: string;
  detail: string;
  qty: number;
  unitPrice: number;
};

export type ProposalStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "changes_requested";

export type Proposal = {
  id: string;
  code: string;
  token: string;
  title: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  lines: ProposalLine[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  validityDays: number;
  notes: string;
  status: ProposalStatus;
  clientComment: string;
  createdAt: string;
  updatedAt: string;
};

export type ProposalDraft = {
  title: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  lines: ProposalLine[];
  discountPercent: number;
  taxRate: number;
  validityDays: number;
  notes: string;
};

/* ------------------------- Service catalogue ------------------------- */

export type ProposalServiceItem = {
  key: ProposalServiceKey;
  label: string;
  detail: string;
  defaultPrice: number;
  monthly: boolean;
};

/** Proposal service catalogue — SEED SOURCE for `site_settings.proposal_catalog`. */
export const SERVICE_CATALOG: readonly ProposalServiceItem[] = [
  { key: "website", label: "Website", detail: "Site institucional ou landing page, design editorial e responsivo.", defaultPrice: 45000, monthly: false },
  { key: "hosting", label: "Alojamento", detail: "Hosting com email profissional, SSL e backups (1 ano).", defaultPrice: 9990, monthly: false },
  { key: "domain", label: "Domínio", detail: "Registo de domínio .co.mz ou .com (1 ano).", defaultPrice: 2500, monthly: false },
  { key: "seo", label: "SEO", detail: "Otimização de pesquisa e estratégia de conteúdo (mensal).", defaultPrice: 12500, monthly: true },
  { key: "marketing", label: "Marketing", detail: "Gestão de redes sociais e campanhas (mensal).", defaultPrice: 15000, monthly: true },
  { key: "maintenance", label: "Manutenção", detail: "Atualizações, monitorização e suporte (mensal).", defaultPrice: 5000, monthly: true },
];

export function catalogFor(key: ProposalServiceKey, catalog: readonly ProposalServiceItem[]): ProposalServiceItem {
  return catalog.find((s) => s.key === key) ?? catalog[0];
}

/* --------------------------- Calculations ---------------------------- */

export function proposalSubtotal(lines: ProposalLine[]): number {
  return lines.reduce((sum, l) => sum + (l.qty || 1) * (l.unitPrice || 0), 0);
}

export function computeProposal(
  draft: ProposalDraft,
): Pick<Proposal, "subtotal" | "discountPercent" | "discountAmount" | "taxRate" | "taxAmount" | "total"> {
  const subtotal = proposalSubtotal(draft.lines);
  const discountPercent = Math.max(0, Math.min(100, Math.round(draft.discountPercent) || 0));
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const net = subtotal - discountAmount;
  const taxRate = Math.max(0, Math.min(100, Math.round(draft.taxRate) || 0));
  const taxAmount = Math.round((net * taxRate) / 100);
  const total = net + taxAmount;
  return { subtotal, discountPercent, discountAmount, taxRate, taxAmount, total };
}

export function buildProposal(
  draft: ProposalDraft,
  meta: { id: string; code: string; token: string; status: ProposalStatus; clientComment: string; createdAt: string; updatedAt: string },
): Proposal {
  return { ...meta, ...draft, ...computeProposal(draft) };
}

/* ------------------------------ Status ------------------------------- */

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  approved: "Aprovada",
  rejected: "Rejeitada",
  changes_requested: "Alterações pedidas",
};

export const PROPOSAL_STATUS_TONE: Record<ProposalStatus, "brand" | "warn" | "ok" | "muted"> = {
  draft: "muted",
  sent: "brand",
  approved: "ok",
  rejected: "warn",
  changes_requested: "warn",
};

export function proposalShareUrl(token: string): string {
  if (typeof window === "undefined") return `/proposta/${token}`;
  return `${window.location.origin}/proposta/${token}`;
}

/* ------------------------------- PDF --------------------------------- */

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function fmtPt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export function buildProposalPdfHtml(p: Proposal, company: CompanyInfo): string {
  const rows = p.lines
    .map(
      (l) => `<tr>
        <td><strong>${esc(l.label)}</strong><div class="muted">${esc(l.detail)}</div></td>
        <td style="text-align:center;min-width:52px;">${l.qty}</td>
        <td style="text-align:right;min-width:100px;">${fmtMT(l.unitPrice)} MT</td>
        <td style="text-align:right;min-width:110px;">${fmtMT(l.unitPrice * l.qty)} MT</td>
      </tr>`,
    )
    .join("");
  const validUntil = new Date(p.createdAt);
  validUntil.setDate(validUntil.getDate() + (p.validityDays || 30));
  const statusStyle: Record<string, string> = {
    draft: "#6b7280",
    sent: "#0f62fe",
    approved: "#0a7a2f",
    rejected: "#b42318",
    changes_requested: "#b54708",
  };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:0}
    *{box-sizing:border-box}
    body{font-family:Helvetica,Arial,sans-serif;color:#111;margin:0;padding:40px 44px;font-size:13px;line-height:1.5}
    .row{display:flex;justify-content:space-between;align-items:flex-start}
    .brand{font-size:22px;font-weight:700;letter-spacing:-.05em}
    .brand span{color:#7c3aed}
    .muted{color:#555}
    .head{margin:34px 0 26px}
    .head h1{font-size:30px;margin:0 0 4px;letter-spacing:-.02em}
    .code{font-size:13px;color:#555;margin-bottom:12px}
    .status{display:inline-block;border:1px solid currentColor;padding:4px 14px;border-radius:20px;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${statusStyle[p.status]}}
    table{width:100%;border-collapse:collapse;margin-top:22px}
    th{text-align:left;font-size:10px;text-transform:uppercase;color:#555;border-bottom:2px solid #111;padding:8px 0}
    td{padding:11px 0;border-bottom:1px solid #ececec;vertical-align:top}
    .totals{width:300px;margin-left:auto;margin-top:16px}
    .totals div{display:flex;justify-content:space-between;padding:5px 0}
    .totals .grand{border-top:2px solid #111;font-weight:700;font-size:16px;padding-top:9px}
    .notes{margin-top:26px;border:1px solid #eee;border-radius:8px;padding:14px 16px;background:#fafafa}
    .notes h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#555}
    .footer{margin-top:44px;padding-top:14px;border-top:1px solid #ddd;font-size:11px;color:#777}
  </style></head><body>
    <div class="row">
      <div class="brand">${esc(company.name)}</div>
      <div style="text-align:right;font-size:11px">
        <div>${esc(company.address)}</div>
        <div>${company.nuit ? `NUIT ${esc(company.nuit)}` : ""}${company.nuit && company.email ? " · " : ""}${esc(company.email)}</div>
      </div>
    </div>
    <div class="head row">
      <div>
        <div class="code">${esc(p.code)}</div>
        <h1>Proposta Comercial</h1>
        <div class="muted">Emitida em ${fmtPt(p.createdAt)} · válida até ${fmtPt(validUntil.toISOString())}</div>
      </div>
      <span class="status">${PROPOSAL_STATUS_LABEL[p.status]}</span>
    </div>
    <div class="row" style="margin-bottom:8px">
      <div>
        <div class="muted" style="text-transform:uppercase;font-size:10px">Proponente</div>
        <div style="font-weight:700;margin-top:2px">${esc(company.name)}</div>
        <div class="muted">${esc(p.title)}</div>
      </div>
      <div style="text-align:right">
        <div class="muted" style="text-transform:uppercase;font-size:10px">Cliente</div>
        <div style="font-weight:700;margin-top:2px">${esc(p.clientName)}</div>
        <div class="muted">${esc(p.clientCompany || "")}${p.clientEmail ? ` · ${esc(p.clientEmail)}` : ""}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Serviço</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço unit.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span class="muted">Subtotal</span><span>${fmtMT(p.subtotal)} MT</span></div>
      <div><span class="muted">Desconto (${p.discountPercent}%)</span><span>-${fmtMT(p.discountAmount)} MT</span></div>
      <div><span class="muted">Imposto (${p.taxRate}%)</span><span>+${fmtMT(p.taxAmount)} MT</span></div>
      <div class="grand"><span>Total</span><span>${fmtMT(p.total)} MT</span></div>
    </div>
    ${p.notes ? `<div class="notes"><h3>Notas</h3><div>${esc(p.notes)}</div></div>` : ""}
    <div class="footer">Obrigado pela sua confiança. Pagamentos disponíveis: Transferência bancária, M-Pesa, e-Mola, mKesh, Visa e Mastercard.</div>
  </body></html>`;
}

export function downloadProposalPdf(p: Proposal, company: CompanyInfo): string {
  const html = buildProposalPdfHtml(p, company);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.title = "Proposta PDF";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
  const printWindow = iframe.contentWindow;
  if (printWindow) {
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  }
  window.setTimeout(() => iframe.remove(), 120000);
  return fmtMT(p.total);
}