"use client";

import { useState } from "react";

import {
  downloadInvoicePdf,
  fmtDate,
  fmtMT,
  invoiceSubtotal,
  invoiceTax,
  invoiceTotal,
  type Invoice,
} from "@/lib/invoices";
import type { CompanyInfo } from "@/lib/site-settings";

function InvoiceCard({ invoice, company }: { invoice: Invoice; company: CompanyInfo }) {
  const subtotal = invoiceSubtotal(invoice);
  const tax = invoiceTax(subtotal, invoice.taxRate);
  const total = invoiceTotal(invoice);

  return (
    <article className="invoice-card">
      <div className="invoice-head">
        <div>
          <span className="order-label">Invoice</span>
          <h3>{invoice.id}</h3>
          <p className="invoice-dates">
            Emitida em {fmtDate(invoice.date)} · Vencimento {fmtDate(invoice.dueDate)}
          </p>
        </div>
        <span className="invoice-status">{invoice.status}</span>
      </div>

      <div className="invoice-parties">
        <div>
          <span className="order-label">From</span>
          <p className="invoice-company">{company.name}</p>
          <p className="invoice-muted">{company.address}</p>
          {company.nuit ? <p className="invoice-muted">NUIT {company.nuit}</p> : null}
        </div>
        <div>
          <span className="order-label">Customer</span>
          <p className="invoice-company">{invoice.customerName}</p>
          {invoice.customerAddress ? (
            <p className="invoice-muted">{invoice.customerAddress}</p>
          ) : null}
          {invoice.customerNuit ? (
            <p className="invoice-muted">NUIT {invoice.customerNuit}</p>
          ) : null}
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>Products</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={`${line.product}-${line.quantity}`}>
              <td>{line.product}</td>
              <td>{line.quantity}</td>
              <td>{fmtMT(line.unitPrice)} MT</td>
              <td>{fmtMT(line.unitPrice * line.quantity)} MT</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <div>
          <span>Subtotal</span>
          <b>{fmtMT(subtotal)} MT</b>
        </div>
        <div>
          <span>Tax ({invoice.taxRate}%)</span>
          <b>{fmtMT(tax)} MT</b>
        </div>
        <div>
          <span>Discount</span>
          <b>-{fmtMT(invoice.discount)} MT</b>
        </div>
        <div className="invoice-grand">
          <span>Total</span>
          <b>{fmtMT(total)} MT</b>
        </div>
      </div>

      <div className="invoice-actions">
        <button
          className="button"
          type="button"
          onClick={() => downloadInvoicePdf(invoice, company)}
        >
          Download PDF ↗
        </button>
      </div>
    </article>
  );
}

export function InvoicesView({ invoices, company }: { invoices: Invoice[]; company: CompanyInfo }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? invoices.find((i) => i.id === openId) : undefined;

  if (open) {
    return (
      <div className="space-y-6">
        <div className="project-detail-head">
          <button className="outline-button" type="button" onClick={() => setOpenId(null)}>
            ← Voltar
          </button>
          <div>
            <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
              Invoice {open.id}
            </h1>
            <p className="text-muted">{open.customerName}</p>
          </div>
        </div>
        <InvoiceCard invoice={open} company={company} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Facturas
        </h1>
        <p className="text-muted">Todas as suas facturas e recibos.</p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {invoices.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não tem facturas.
          </div>
        )}
        {invoices.map((invoice) => (
          <button
            className="invoice-row"
            key={invoice.id}
            type="button"
            onClick={() => setOpenId(invoice.id)}
          >
            <div>
              <strong>{invoice.id}</strong>
              <p className="invoice-muted">{invoice.customerName}</p>
            </div>
            <div className="invoice-row-mid">
              <span className="invoice-status">{invoice.status}</span>
              <span className="invoice-muted">{fmtDate(invoice.date)}</span>
            </div>
            <b>{fmtMT(invoiceTotal(invoice))} MT</b>
          </button>
        ))}
      </div>
    </div>
  );
}
