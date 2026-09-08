"use client";
import { useCallback, useState } from "react";
import type { AdminData, MessageStatus, OrderStatus, UserRole } from "./types";
import * as api from "./api";

export type ActionResult = { ok: true; note?: string; mode?: string } | { ok: false; error: string };

export function useAdminData(initial: AdminData) {
  const [data, setData] = useState<AdminData>({
    messages: initial.messages,
    orders: initial.orders,
    domains: initial.domains,
    profiles: initial.profiles,
    emailByUserId: initial.emailByUserId,
    subscriptions: initial.subscriptions,
  });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const wrap = useCallback(
    async (id: string | undefined, fn: () => Promise<unknown>): Promise<ActionResult> => {
      if (id) setBusy((b) => ({ ...b, [id]: true }));
      try {
        const extra = (await fn()) as { note?: string; mode?: string } | undefined;
        return { ok: true, ...(extra?.note ? { note: extra.note } : {}), ...(extra?.mode ? { mode: extra.mode } : {}) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Erro na requisição." };
      } finally {
        if (id) setBusy((b) => {
          const next = { ...b };
          delete next[id];
          return next;
        });
      }
    },
    []
  );

  const isBusy = useCallback((id: string) => !!busy[id], [busy]);

  const refresh = useCallback(async (): Promise<ActionResult> => {
    setRefreshing(true);
    try {
      const body = await api.getDashboard();
      setData(body.data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar." };
    } finally {
      setRefreshing(false);
    }
  }, []);

  const actions = {
    setMessageStatus: (id: string, status: MessageStatus) =>
      wrap(id, async () => {
        await api.patchMessageStatus(id, status);
        setData((d) => ({ ...d, messages: d.messages.map((m) => (m.id === id ? { ...m, status } : m)) }));
      }),

    deleteMessage: (id: string) =>
      wrap(id, async () => {
        await api.deleteMessage(id);
        setData((d) => ({ ...d, messages: d.messages.filter((m) => m.id !== id) }));
      }),

    setOrderStatus: (id: string, status: OrderStatus) =>
      wrap(id, async () => {
        await api.patchOrderStatus(id, status);
        setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
        return {};
      }),

    registerOrder: (id: string) =>
      wrap(id, async () => {
        const body = await api.registerOrderDomain(id);
        setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? { ...o, status: "registered" as const } : o)) }));
        const dashboard = await api.getDashboard();
        setData((d) => ({ ...d, domains: dashboard.data.domains, orders: dashboard.data.orders }));
        return body;
      }),

    deleteOrder: (id: string) =>
      wrap(id, async () => {
        await api.deleteOrder(id);
        setData((d) => ({ ...d, orders: d.orders.filter((o) => o.id !== id) }));
      }),

    recheckDomain: (id: string) =>
      wrap(id, async () => {
        const body = await api.recheckDomain(id);
        setData((d) => ({
          ...d,
          domains: d.domains.map((x) => (x.id === id ? { ...x, status: body.domain.status, checked_at: body.domain.checked_at } : x)),
        }));
      }),

    deleteDomain: (id: string) =>
      wrap(id, async () => {
        await api.deleteDomain(id);
        setData((d) => ({ ...d, domains: d.domains.filter((x) => x.id !== id) }));
      }),

    setUserRole: (id: string, role: UserRole) =>
      wrap(id, async () => {
        await api.patchUserRole(id, role);
        setData((d) => ({ ...d, profiles: d.profiles.map((p) => (p.id === id ? { ...p, role } : p)) }));
      }),

    runBillingCheck: () =>
      wrap("__billing", async () => {
        const body = await api.runBillingCheck();
        const dashboard = await api.getDashboard();
        setData((d) => ({ ...d, subscriptions: dashboard.data.subscriptions }));
        return { note: `${body.result.checked} verificadas · ${body.result.pastDue} em atraso · ${body.result.suspended} suspensas · ${body.result.terminated} terminadas` };
      }),
  };

  return { data, refresh, refreshing, isBusy, actions };
}