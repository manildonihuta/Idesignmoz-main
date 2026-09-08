import type { AdminData, MessageStatus, OrderStatus, UserRole } from "./types";

const BASE = "/api/admin";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error ?? "Erro na requisição.");
  }
  return body as T;
}

export const getDashboard = () => req<{ ok: true; data: AdminData }>(`${BASE}/data`);

export const patchMessageStatus = (id: string, status: MessageStatus) =>
  req(`${BASE}/messages`, { method: "PATCH", body: JSON.stringify({ id, status }) });

export const deleteMessage = (id: string) =>
  req(`${BASE}/messages`, { method: "DELETE", body: JSON.stringify({ id }) });

export const patchOrderStatus = (id: string, status: OrderStatus) =>
  req(`${BASE}/orders`, { method: "PATCH", body: JSON.stringify({ id, status }) });

export const deleteOrder = (id: string) =>
  req(`${BASE}/orders`, { method: "DELETE", body: JSON.stringify({ id }) });

export const registerOrderDomain = (orderId: string) =>
  req<{ ok: true; mode: "manual" | "automatic" | "already"; note?: string }>(`${BASE}/domains/register`, {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });

export const recheckDomain = (id: string) =>
  req<{ ok: true; domain: import("./types").AdminDomain }>(`${BASE}/domains`, {
    method: "POST",
    body: JSON.stringify({ id }),
  });

export const deleteDomain = (id: string) =>
  req(`${BASE}/domains`, { method: "DELETE", body: JSON.stringify({ id }) });

export const patchUserRole = (id: string, role: UserRole) =>
  req(`${BASE}/profiles`, { method: "PATCH", body: JSON.stringify({ id, role }) });

export const runBillingCheck = () =>
  req<{ ok: true; result: { checked: number; pastDue: number; suspended: number; terminated: number } }>(`${BASE}/subscriptions`, {
    method: "POST",
  });