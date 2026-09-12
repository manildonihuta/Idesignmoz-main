/*
 * Types + pure helpers for the admin catalog/management views.
 *
 * Data is read from / written to the database via `/api/admin/store/[kind]`
 * (server-side, `site_settings`), NOT localStorage. This module only holds
 * the record shapes, ID generation and option pools used by the views.
 * Seed data lives in `scripts/seed-admin-stores.test.ts`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type CustomerStatus = "Ativo" | "Suspenso";

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  nuit?: string;
  status: CustomerStatus;
  createdAt: string;
};

export type RelatedKind =
  | "Pedidos"
  | "Pagamentos"
  | "Domínios"
  | "Hosting"
  | "Projetos"
  | "Tickets";

export type RelatedRow = {
  id: string;
  title: string;
  meta: string;
  status: string;
  value?: string;
};

export type AdminCategory = { id: string; name: string };

export type AdminProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  period: string;
  features: string[];
  active: boolean;
};

export type AdminPlan = {
  id: string;
  name: string;
  category: string;
  price: number;
  period: string;
  features: string[];
  active: boolean;
};

export type AdminCoupon = {
  id: string;
  code: string;
  percent: number;
  active: boolean;
};

export type AdminCatalog = {
  categories: AdminCategory[];
  products: AdminProduct[];
  plans: AdminPlan[];
  coupons: AdminCoupon[];
};

export type AdminExtension = {
  extension: string;
  register: number;
  renewal: number;
  transfer: number;
  available: boolean;
  suspended: boolean;
  expires: string;
  renewCount: number;
};

export const EXPIRY_POOL = [
  "30 Jan 2027",
  "30 Jan 2028",
  "30 Jan 2029",
  "30 Jan 2030",
];

export type AdminHostingPlanRow = {
  id: string;
  name: string;
  server: string;
  storage: string;
  websites: string;
  emails: string;
  databases: string;
  monthly: number;
  annual: number;
  cycle: "monthly" | "annual";
  status: "Ativo" | "Suspenso";
};

/**
 * Async, DB-backed store hook used by the admin views (replaces the previous
 * `loadStore`/`saveStore` localStorage helpers). Loads the full store value
 * from `/api/admin/store/:kind` on mount; `persist` overwrites the whole
 * value server-side (optimistic local update, errors surface on reload).
 */
export function useAdminStore<T>(kind: string, empty: () => T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(empty);
  const emptyRef = useRef(empty);
  useEffect(() => {
    emptyRef.current = empty;
  });

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/store/${kind}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ ok?: boolean; value?: unknown }>) : null))
      .then((data) => {
        if (!live) return;
        if (data?.ok && data.value != null) {
          setValue(data.value as T);
        }
      })
      .catch(() => {
        /* keep the empty initial value on failure */
      });
    return () => {
      live = false;
    };
  }, [kind]);

  const persist = useCallback(
    (next: T) => {
      setValue(next);
      void fetch(`/api/admin/store/${kind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      }).catch(() => {
        /* optimistic write; errors surface on reload */
      });
    },
    [kind],
  );

  return [value, persist] as const;
}

export function nextId(prefix: string, items: Array<{ id: string }>, base: number): string {
  return `${prefix}-${base + items.length + 1}`;
}

const RELATION_POOLS: Record<RelatedKind, RelatedRow[]> = {
  Pedidos: [
    { id: "IDM-1093", title: "Loja Online E-commerce", meta: "01 Set 2026 · Fase inicial", status: "Em progresso", value: "85 000 MT" },
    { id: "IDM-1092", title: "Business Website", meta: "28 Ago 2026", status: "Pago", value: "55 000 MT" },
    { id: "IDM-1087", title: "Hosting Business (1 ano)", meta: "15 Ago 2026", status: "Pago", value: "9 990 MT" },
    { id: "IDM-1080", title: "Domínio .com — 1 ano", meta: "20 Jul 2026", status: "Ativo", value: "900 MT" },
  ],
  Pagamentos: [
    { id: "PAY-2048", title: "Business Website", meta: "M-Pesa · 01 Set 2026", status: "Pago", value: "55 000 MT" },
    { id: "PAY-2047", title: "Hosting Business (1 ano)", meta: "Visa •••• 4242 · 15 Ago 2026", status: "Pago", value: "9 990 MT" },
    { id: "PAY-2039", title: "Domínio .com", meta: "e-Mola · 20 Jul 2026", status: "Pago", value: "900 MT" },
  ],
  Domínios: [
    { id: "DOM-0031", title: "amplius.co.mz", meta: "Registo · expira 30 Jan 2027", status: "Ativo", value: ".co.mz" },
    { id: "DOM-0029", title: "kayacolectivo.com", meta: "Registo · expira 18 Fev 2027", status: "Ativo", value: ".com" },
    { id: "DOM-0018", title: "company.co.mz", meta: "Renovação · expira 12 Mar 2027", status: "Ativo", value: ".co.mz" },
  ],
  Hosting: [
    { id: "HST-011", title: "Business", meta: "30 GB NVMe · 10 sites", status: "Ativo", value: "9 990 MT/ano" },
    { id: "HST-009", title: "Email 50", meta: "50 mailboxes", status: "Ativo", value: "4 990 MT/ano" },
    { id: "HST-007", title: "Pro", meta: "100 GB NVMe · ilimitado", status: "Ativo", value: "19 990 MT/ano" },
  ],
  Projetos: [
    { id: "PRJ-1009", title: "Website Corporativo", meta: "Design → Página inicial", status: "Em progresso", value: "65%" },
    { id: "PRJ-1008", title: "Loja Online", meta: "Design aprovado", status: "Em progresso", value: "40%" },
    { id: "PRJ-1006", title: "Marca + Website", meta: "Lançado a 02 Jul 2026", status: "Concluído", value: "100%" },
  ],
  Tickets: [
    { id: "TKT-2001", title: "Fatura do domínio .com", meta: "Billing · 03 Set 2026", status: "Aberto", value: "Alta" },
    { id: "TKT-1998", title: "Configurar email profissional", meta: "Suporte técnico · 28 Ago 2026", status: "Resolvido", value: "Normal" },
    { id: "TKT-1995", title: "Relatório do website", meta: "Website · 21 Ago 2026", status: "Em progresso", value: "Normal" },
  ],
};

export const RELATED_KINDS: RelatedKind[] = [
  "Pedidos",
  "Pagamentos",
  "Domínios",
  "Hosting",
  "Projetos",
  "Tickets",
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function relatedFor(customer: AdminCustomer, kind: RelatedKind): RelatedRow[] {
  const pool = RELATION_POOLS[kind];
  const start = hashId(customer.id + kind) % pool.length;
  const count = Math.min(3, pool.length);
  const out: RelatedRow[] = [];
  for (let i = 0; i < count; i++) {
    const row = pool[(start + i) % pool.length];
    if (row) out.push({ ...row, id: `${customer.id}-${row.id}` });
  }
  return out;
}

export const SERVERS = ["Shared", "WordPress", "Business", "VPS", "Reseller", "Email"];