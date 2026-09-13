import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSiteSettings, getCompanyInfo } from "@/lib/site-settings";
import { notifyEvent } from "@/lib/notifications";
import { serverLogError } from "@/lib/server-log";
import { buildInvoicePdfHtml, fmtMT, type Invoice } from "@/lib/invoices";
import { listClientInvoices, type ClientInvoice } from "@/lib/client-data";
import type { AuthContext } from "@/lib/client";
import { fail, type ServiceResult } from "./result";

export type OrderForInvoice = {
  id: string;
  number: string | null;
  customer_id: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
};

/**
 * Creates the database invoice (number, lines, tax) for a paid order and
 * notifies the billing roles. Returns the inserted invoice row.
 */
export async function createInvoiceFromOrder(
  order: OrderForInvoice,
  payment: { id: string; paid_at?: string | null; meta?: unknown },
): Promise<Record<string, unknown> & { id: string }> {
  const settings = await getSiteSettings();
  const prefix = settings.payments?.invoiceNumberPrefix || "INV-";
  const settingsTaxRate = Number(settings.tax?.rate ?? 15);

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  const { count } = await supabaseAdmin
    .from("invoices")
    .select("id", { count: "exact", head: true });

  const seq = (count ?? 0) + 1;
  const number = `${prefix}${String(seq).padStart(4, "0")}`;

  const subtotal = Number(order.subtotal ?? 0);
  const discount = Number(order.discount_amount ?? 0);
  const taxRate = Number(order.tax_rate ?? 0) || settingsTaxRate;
  let taxAmount = Number(order.tax_amount ?? 0);
  // Legacy orders stored the tax rate but no tax amount — derive it the same
  // way the checkout prices now: IVA included in prices by default.
  if (taxAmount === 0 && taxRate > 0) {
    taxAmount = Math.round((subtotal * taxRate) / 100);
  }
  const total = Math.max(0, subtotal - discount + taxAmount);

  const paid = order.status === "paid";
  const now = new Date();
  const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .insert({
      number,
      customer_id: order.customer_id,
      order_id: order.id,
      status: paid ? "paid" : "issued",
      subtotal,
      discount_amount: discount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      currency: order.currency ?? "MZN",
      issued_at: now.toISOString(),
      due_at: due.toISOString(),
      paid_at: paid ? (payment.paid_at ?? now.toISOString()) : null,
      notes: order.notes,
    })
    .select()
    .single();

  if (error || !invoice) {
    throw new Error(error?.message ?? "Invoice insert failed");
  }

  const rows = (items ?? []).map((item) => ({
    invoice_id: invoice.id,
    description: item.label,
    qty: item.qty,
    unit_price: Number(item.unit_price ?? 0),
    line_total: Number(item.line_total ?? item.unit_price ?? 0),
    tax_rate: taxRate,
  }));
  if (rows.length > 0) {
    const { error: itemsError } = await supabaseAdmin.from("invoice_items").insert(rows);
    if (itemsError) {
      serverLogError("service:invoice.createInvoiceFromOrder", itemsError);
    }
  }

  await notifyEvent(
    "invoice.created",
    { number, total: Math.round(total) },
    {},
  );

  return invoice as Record<string, unknown> & { id: string };
}

export async function listClient(ctx: AuthContext): Promise<ClientInvoice[]> {
  return listClientInvoices(ctx);
}

/**
 * Builds the printable invoice HTML for a single invoice. Ownership must be
 * enforced by the caller (only the invoice's customer may fetch it).
 */
export async function pdfHtml(invoiceId: string): Promise<ServiceResult<{ html: string; number?: string | null }>> {
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    return fail(404, "Fatura não encontrada.");
  }

  const { data: items } = await supabaseAdmin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  let customerName = "Cliente";
  if (invoice.customer_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", invoice.customer_id)
      .maybeSingle();
    if (profile?.full_name) customerName = String(profile.full_name);
  }

  const company = await getCompanyInfo();
  const taxRate = Number(invoice.tax_rate ?? 0);

  const doc: Invoice = {
    id: String(invoice.number ?? invoice.id),
    date: String(invoice.issued_at ?? new Date().toISOString()).slice(0, 10),
    dueDate: String(invoice.due_at ?? invoice.issued_at ?? new Date().toISOString()).slice(0, 10),
    status: invoice.status === "paid" ? "PAID" : "PENDING",
    customerName,
    lines: (items ?? []).map((item) => ({
      product: item.description,
      quantity: item.qty,
      unitPrice: Number(item.unit_price),
    })),
    taxRate,
    discount: Number(invoice.discount_amount ?? 0),
  };

  const html = buildInvoicePdfHtml(doc, company);
  return {
    ok: true,
    html,
    number: invoice.number ?? null,
  };
}

export { fmtMT };