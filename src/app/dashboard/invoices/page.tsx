import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { InvoicesView } from "@/components/invoices-view";
import { getClientContext } from "@/lib/client";
import { listClientInvoices, type ClientInvoice } from "@/lib/client-data";
import type { Invoice } from "@/lib/invoices";
import { getCompanyInfo } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facturas — Área de cliente",
};

function mapDbInvoices(list: ClientInvoice[]): Invoice[] {
  return list.map((inv) => ({
    id: inv.number || inv.id.slice(0, 12).toUpperCase(),
    date: (inv.issuedAt ?? inv.createdAt).slice(0, 10),
    dueDate: (inv.dueAt ?? inv.createdAt).slice(0, 10),
    status: inv.status.toLowerCase() === "paid" ? "PAID" : "PENDING",
    customerName: "Cliente",
    lines: inv.items.map((item) => ({
      product: item.description,
      quantity: item.qty,
      unitPrice: Math.round(item.unitPrice),
    })),
    taxRate: inv.taxRate,
    discount: inv.discount,
  }));
}

export default async function DashboardInvoicesPage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  const dbInvoices = await listClientInvoices(ctx);
  const company = await getCompanyInfo();

  return (
    <DashboardShell>
      <InvoicesView invoices={mapDbInvoices(dbInvoices)} company={company} />
    </DashboardShell>
  );
}
