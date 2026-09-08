import "server-only";

import { fetchAdminDashboard, type AdminDashboard } from "@/lib/admin";
import { getAnalyticsReport, type AnalyticsReport, type PeriodDays } from "@/lib/analytics";
import {
  countClientItems,
  listClientOwnedCategories,
  listClientTickets,
  listClientInvoices,
  listClientProjects,
  listClientOrders,
  listClientPayments,
  listClientHostingAccounts,
} from "@/lib/client-data";
import { listClientSubscriptions } from "./billing.service";
import type { AuthContext } from "@/lib/client";
import type { ProductCategory } from "@/lib/catalog-types";
import { getCrossSellOffers } from "@/lib/content";
import { fail, type ServiceResult } from "./result";

export function adminDashboard(): Promise<AdminDashboard> {
  return fetchAdminDashboard();
}

export function analyticsReport(days: PeriodDays): Promise<AnalyticsReport> {
  return getAnalyticsReport(days);
}

export type ClientDashboard = {
  counts: Awaited<ReturnType<typeof countClientItems>>;
  categories: ProductCategory[];
  crossSell: Awaited<ReturnType<typeof getCrossSellOffers>>;
  tickets: Awaited<ReturnType<typeof listClientTickets>>;
  invoices: Awaited<ReturnType<typeof listClientInvoices>>;
  projects: Awaited<ReturnType<typeof listClientProjects>>;
  orders: Awaited<ReturnType<typeof listClientOrders>>;
  payments: Awaited<ReturnType<typeof listClientPayments>>;
  hosting: Awaited<ReturnType<typeof listClientHostingAccounts>>;
  subscriptions: Awaited<ReturnType<typeof listClientSubscriptions>>;
};

export async function clientDashboard(ctx: AuthContext): Promise<ServiceResult<ClientDashboard>> {
  if (!ctx.userId) {
    return fail(401, "Não autenticado.");
  }

  const [counts, categories, tickets, invoices, projects, orders, payments, hosting, subscriptions] =
    await Promise.all([
      countClientItems(ctx),
      listClientOwnedCategories(ctx),
      listClientTickets(ctx),
      listClientInvoices(ctx),
      listClientProjects(ctx),
      listClientOrders(ctx),
      listClientPayments(ctx),
      listClientHostingAccounts(ctx),
      listClientSubscriptions(ctx),
    ]);

  const crossSell = await getCrossSellOffers(categories, 3);

  return {
    ok: true,
    counts,
    categories,
    crossSell,
    tickets,
    invoices,
    projects,
    orders,
    payments,
    hosting,
    subscriptions,
  };
}