import type { CompanyInfo } from "@/lib/site-settings";

export type InvoiceLine = {
  product: string;
  quantity: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  date: string;
  dueDate: string;
  status: "PAID" | "PENDING";
  customerName: string;
  customerAddress?: string;
  customerNuit?: string;
  lines: InvoiceLine[];
  taxRate: number;
  discount: number;
};

export function invoiceSubtotal(invoice: Invoice): number {
  return invoice.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function invoiceTax(subtotal: number, taxRate: number): number {
  return Math.round((subtotal * taxRate) / 100);
}

export function invoiceTotal(invoice: Invoice): number {
  const subtotal = invoiceSubtotal(invoice);
  const tax = invoiceTax(subtotal, invoice.taxRate);
  return subtotal + tax - invoice.discount;
}

export function fmtMT(value: number): string {
  return new Intl.NumberFormat("pt-MZ", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-MZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function buildInvoicePdfHtml(invoice: Invoice, company: CompanyInfo): string {
  const subtotal = invoiceSubtotal(invoice);
  const tax = invoiceTax(subtotal, invoice.taxRate);
  const total = invoiceTotal(invoice);
  const rows = invoice.lines
    .map(
      (l) => `<tr>
        <td>${l.product}</td>
        <td style="text-align:center;min-width:50px;">${l.quantity}</td>
        <td style="text-align:right;min-width:110px;">${fmtMT(l.unitPrice)} MT</td>
        <td style="text-align:right;min-width:110px;">${fmtMT(l.unitPrice * l.quantity)} MT</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Helvetica,Arial,sans-serif;color:#111;margin:0;padding:40px;font-size:13px}
    .row{display:flex;justify-content:space-between}.brand{font-size:22px;font-weight:700;letter-spacing:-.05em}
    .muted{color:#666}.inv-head{margin:36px 0 28px}.inv-head h1{font-size:30px;margin:0 0 4px}
    table{width:100%;border-collapse:collapse;margin-top:20px}.td{border-top:1px solid #ddd}
    th{text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:1px solid #bbb;padding:8px 0}
    td{padding:10px 0;border-bottom:1px solid #eee}.totals{width:260px;margin-left:auto;margin-top:14px}
    .totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{border-top:2px solid #111;font-weight:700;font-size:15px;padding-top:8px}
    .status{display:inline-block;border:1px solid #0a7a2f;color:#0a7a2f;padding:4px 12px;border-radius:20px;font-weight:700;font-size:11px;letter-spacing:.08em}
  </style></head><body>
    <div class="row"><div class="brand">${company.name}</div><div style="text-align:right"><div>${company.address}</div>${company.nuit ? `<div>NUIT ${company.nuit}</div>` : ""}<div>${company.email}</div></div></div>
    <div class="inv-head"><div class="row"><div><h1>Invoice ${invoice.id}</h1><div class="muted">Issued ${fmtDate(invoice.date)} · Due ${fmtDate(invoice.dueDate)}</div></div><span class="status">${invoice.status}</span></div></div>
    <div class="muted">Bill To</div><div style="font-weight:700;margin-top:2px">${invoice.customerName}</div><div class="muted">${invoice.customerAddress ?? ""}${invoice.customerNuit ? ` · NUIT ${invoice.customerNuit}` : ""}</div>
    <table><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div><span class="muted">Subtotal</span><span>${fmtMT(subtotal)} MT</span></div><div><span class="muted">Tax (${invoice.taxRate}%)</span><span>${fmtMT(tax)} MT</span></div><div><span class="muted">Discount</span><span>-${fmtMT(invoice.discount)} MT</span></div><div class="grand"><span>Total</span><span>${fmtMT(total)} MT</span></div></div>
    <p class="muted" style="margin-top:40px">Obrigado pela sua confiança. Pagamentos disponíveis: Transferência bancária, M-Pesa, e-Mola, mKesh, Visa e Mastercard.</p>
  </body></html>`;
}

export function downloadInvoicePdf(invoice: Invoice, company: CompanyInfo): string {
  const html = buildInvoicePdfHtml(invoice, company);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice-${invoice.id}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fmtMT(invoiceTotal(invoice));
}