import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: Record<string, Row[]> = {};
  const writes: Array<{ table: string; op: "insert" | "update"; row: Row }> = [];

  type Filter = { op: string; field: string; value: unknown };
  function matches(row: Row, f: Filter): boolean {
    const v = row[f.field];
    switch (f.op) {
      case "eq":
        return v === f.value;
      case "neq":
        return v !== f.value;
      case "in":
        return Array.isArray(f.value) && f.value.includes(v);
      case "gte":
        return Number(v) >= Number(f.value);
      case "lte":
        return Number(v) <= Number(f.value);
      default:
        return true;
    }
  }
  function filtered(table: string, filters: Filter[]): Row[] {
    return (store[table] ?? []).filter((row) => filters.every((f) => matches(row, f)));
  }

  let seq = 0;
  const makeChain = (table: string) => {
    const filters: Filter[] = [];
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => {
        filters.push({ op: "eq", field, value });
        return chain;
      },
      not: (field: string, op: string, value: unknown) => {
        filters.push({ op: op === "is" ? (value === null ? "neq" : "eq") : "neq", field, value });
        return chain;
      },
      in: (field: string, value: unknown) => {
        filters.push({ op: "in", field, value });
        return chain;
      },
      gte: (field: string, value: unknown) => {
        filters.push({ op: "gte", field, value });
        return chain;
      },
      lte: (field: string, value: unknown) => {
        filters.push({ op: "lte", field, value });
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: async (): Promise<{ data: Row | null; error: null }> => ({
        data: filtered(table, filters)[0] ?? null,
        error: null,
      }),
      single: async (): Promise<{ data: Row | null; error: null }> => ({
        data: filtered(table, filters)[0] ?? null,
        error: null,
      }),
      count: async () => ({ data: filtered(table, filters).length, error: null }),
      selectCount: async (): Promise<{ count: number | null; error: null }> => ({
        count: filtered(table, filters).length,
        error: null,
      }),
      then(onfulfilled?: (v: { data: Row[]; error: null }) => unknown): Promise<unknown> {
        return Promise.resolve({ data: filtered(table, filters), error: null }).then(onfulfilled);
      },
      insert: (row: Row) => {
        const withId = { id: `id-${(seq += 1)}`, created_at: new Date().toISOString(), ...row };
        store[table] = [withId, ...(store[table] ?? [])].slice(0, 50);
        writes.push({ table, op: "insert", row: withId });
        return chain;
      },
      update: (row: Row) => {
        store[table] = [row];
        writes.push({ table, op: "update", row });
        return chain;
      },
      rpc: async () => ({ data: null, error: null }),
    };
    return chain;
  };

  const db = {
    from: (table: string) => makeChain(table),
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: [] } })),
      },
    },
  };

  return { store, writes, db };
});

const notifyEventMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, sent: 1, failed: 0 })));
const resolveEmailMock = vi.hoisted(() => vi.fn(async () => "cliente@x.com"));
const logAuditMock = vi.hoisted(() => vi.fn(async () => {}));
const reactivateMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, message: "ok" })));
const selectProviderMock = vi.hoisted(() => () => ({ provider: { reactivate: reactivateMock }, mode: "simulated" }));
const generateNumberMock = vi.hoisted(() => vi.fn(() => "IDM-TEST123"));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: mocks.db }));
vi.mock("@/lib/notifications", () => ({ notifyEvent: notifyEventMock }));
vi.mock("@/lib/notifications/recipients", () => ({
  resolveUserEmail: resolveEmailMock,
}));
vi.mock("@/lib/provisioning/email/registry", () => ({
  selectEmailProvider: selectProviderMock,
}));
vi.mock("@/lib/security/audit", () => ({
  logAudit: logAuditMock,
  AUDIT: {
    ORDER_STATUS: "order.status",
    EMAIL_SERVICE_RENEWED: "email.service.renewed",
  },
}));
vi.mock("@/lib/content", () => ({
  getCatalogProductRows: async () => [
    {
      id: "prod-email-1",
      name: "Professional",
      category: "email",
      price: 500,
      currency: "MZN",
      description: "",
      for_services: [],
      for_pricing: [],
    },
  ],
}));
vi.mock("@/services/payment.service", () => ({
  generateOrderNumber: generateNumberMock,
}));

import { createEmailRenewalRequest, applyEmailRenewalFromOrderItem } from "@/services/email-renewal.service";

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";

function ctx() {
  return { authenticated: true as const, userId: "user-1", email: "user@x.com" };
}

function serviceRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SERVICE_ID,
    customer_id: "user-1",
    domain: "site.com",
    plan_name: "Professional",
    status: "active",
    dns_status: "verified",
    mailbox_limit: 5,
    storage_limit_gb: 5,
    expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    provider_email_id: null,
    provider_status: "active",
    meta: {},
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function reset(): void {
  for (const key of Object.keys(mocks.store)) delete mocks.store[key];
  mocks.writes.length = 0;
  notifyEventMock.mockClear();
  resolveEmailMock.mockClear();
  logAuditMock.mockClear();
  reactivateMock.mockClear();
  generateNumberMock.mockClear();
}

beforeEach(() => reset());

describe("createEmailRenewalRequest", () => {
  it("rejects months outside 1–24", async () => {
    mocks.store.email_services = [serviceRow()];
    const result = await createEmailRenewalRequest(ctx(), SERVICE_ID, { months: 25, method: "mpesa", reference: "R" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("creates a pending order, renewal item and payment with the computed price", async () => {
    mocks.store.email_services = [serviceRow()];

    const result = await createEmailRenewalRequest(ctx(), SERVICE_ID, {
      months: 6,
      method: "mpesa",
      reference: "REF-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.number).toBe("IDM-TEST123");

    const orderWrite = mocks.writes.find((w) => w.op === "insert" && w.table === "orders");
    expect(orderWrite).toBeTruthy();
    expect(orderWrite?.row.status).toBe("pending");
    expect(orderWrite?.row.subtotal).toBe(3000); // 500 MT/mês × 6

    const itemWrite = mocks.writes.find((w) => w.op === "insert" && w.table === "order_items");
    expect((itemWrite?.row.meta as Record<string, unknown>).catalog_kind).toBe("email_renewal");
    expect((itemWrite?.row.meta as Record<string, unknown>).service_id).toBe(SERVICE_ID);
    expect((itemWrite?.row.meta as Record<string, unknown>).months).toBe(6);

    const payWrite = mocks.writes.find((w) => w.op === "insert" && w.table === "payments");
    expect(payWrite?.row.status).toBe("pending");
    expect(payWrite?.row.reference).toBe("REF-1");
  });
});

describe("applyEmailRenewalFromOrderItem", () => {
  it("extends expires_at and clears the expiry suspension for an expired service", async () => {
    mocks.store.email_services = [
      serviceRow({
        status: "suspended",
        expires_at: daysFromNow(-5),
        provider_status: "suspended",
        meta: { expirySuspendedReason: "expired", expirySuspendedAt: daysFromNow(-5), expiryStageSent: "15" },
      }),
    ];

    const result = await applyEmailRenewalFromOrderItem({
      meta: { service_id: SERVICE_ID, months: 3 },
      customerId: "user-1",
      orderId: "order-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reactivated).toBe(true);
    expect(result.expiresAt > new Date().toISOString()).toBe(true);

    expect(reactivateMock).toHaveBeenCalledWith(
      expect.objectContaining({ emailServiceId: SERVICE_ID, domain: "site.com" }),
    );

    const write = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    expect(write?.row.status).toBe("active");
    expect(write?.row.provider_status).toBe("active");
    const meta = write?.row.meta as Record<string, unknown>;
    expect(meta.expirySuspendedReason).toBeUndefined();
    expect(meta.expirySuspendedAt).toBeUndefined();
    expect(meta.expiryStageSent).toBeUndefined();
    expect(meta.lastRenewedMonths).toBe(3);

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "email.service.renewed",
        entity: "email_service",
        entityId: SERVICE_ID,
      }),
    );
  });

  it("extends from the existing expiry (anchor = max(today, expires_at)) without reactivating an active service", async () => {
    const future = daysFromNow(30);
    mocks.store.email_services = [serviceRow({ status: "active", expires_at: future })];

    const result = await applyEmailRenewalFromOrderItem({
      meta: { service_id: SERVICE_ID, months: 6 },
      customerId: "user-1",
      orderId: "order-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const write = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    const expiry = new Date(write?.row.expires_at as string).getTime();
    const expected = new Date(new Date(future).getTime());
    expected.setMonth(expected.getMonth() + 6);
    expect(expiry).toBeGreaterThanOrEqual(expected.getTime() - 1000);
    expect(write?.row.status).toBeUndefined();
    expect(write?.row.provider_status).toBeUndefined();
    expect(reactivateMock).not.toHaveBeenCalled();
  });

  it("fails when the meta lacks a service id", async () => {
    const result = await applyEmailRenewalFromOrderItem({
      meta: { months: 3 },
      customerId: "user-1",
      orderId: "order-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("fails when the service is owned by another customer", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: "other-user" })];
    const result = await applyEmailRenewalFromOrderItem({
      meta: { service_id: SERVICE_ID, months: 3 },
      customerId: "user-1",
      orderId: "order-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });
});