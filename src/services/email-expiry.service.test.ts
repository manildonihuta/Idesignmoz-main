import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: Record<string, Row[]> = {};
  const writes: Array<{ table: string; op: "insert" | "update"; row: Row }> = [];

  type Filter = { op: string; field: string; value: unknown };
  function cmpVal(v: unknown): number {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
      return new Date(v).getTime();
    }
    return Number.NaN;
  }
  function matches(row: Row, f: Filter): boolean {
    const v = row[f.field];
    switch (f.op) {
      case "eq":
        return v === f.value;
      case "neq":
        return v !== f.value;
      case "in":
        return Array.isArray(f.value) && f.value.includes(v);
      case "not_null":
        return v != null;
      case "is_null":
        return v == null;
      case "gte":
        return cmpVal(v) >= cmpVal(f.value);
      case "lte":
        return cmpVal(v) <= cmpVal(f.value);
      case "lt":
        return cmpVal(v) < cmpVal(f.value);
      case "gt":
        return cmpVal(v) > cmpVal(f.value);
      default:
        return true;
    }
  }
  function filtered(table: string, filters: Filter[]): Row[] {
    return (store[table] ?? []).filter((row) => filters.every((f) => matches(row, f)));
  }

  const makeChain = (table: string) => {
    const filters: Filter[] = [];
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => {
        filters.push({ op: "eq", field, value });
        return chain;
      },
      not: (field: string, op: string, value: unknown) => {
        filters.push({ op: op === "is" ? (value === null ? "not_null" : "neq") : "neq", field, value });
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
      lt: (field: string, value: unknown) => {
        filters.push({ op: "lt", field, value });
        return chain;
      },
      gt: (field: string, value: unknown) => {
        filters.push({ op: "gt", field, value });
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
      then(onfulfilled?: (v: { data: Row[]; error: null }) => unknown): Promise<unknown> {
        return Promise.resolve({ data: filtered(table, filters), error: null }).then(onfulfilled);
      },
      insert: (row: Row) => {
        store[table] = [row, ...(store[table] ?? [])].slice(0, 20);
        writes.push({ table, op: "insert", row });
        return chain;
      },
      update: (row: Row) => {
        store[table] = [row];
        writes.push({ table, op: "update", row });
        return chain;
      },
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

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: mocks.db }));
vi.mock("@/lib/notifications", () => ({ notifyEvent: notifyEventMock }));
vi.mock("@/lib/notifications/recipients", () => ({
  resolveUserEmail: resolveEmailMock,
}));
vi.mock("@/lib/provisioning/email/registry", () => ({
  selectEmailProvider: selectProviderMock,
}));

const notifyEventMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, sent: 1, failed: 0 })));
const resolveEmailMock = vi.hoisted(() => vi.fn(async () => "cliente@x.com"));
const suspendMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, message: "ok" })));
const selectProviderMock = vi.hoisted(() => () => ({ provider: { suspend: suspendMock }, mode: "simulated" }));

import { checkExpiringEmailServices } from "@/services/email-expiry.service";

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function serviceRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SERVICE_ID,
    customer_id: "user-1",
    domain: "site.com",
    status: "active",
    expires_at: daysFromNow(20),
    provider_status: "active",
    meta: {},
    ...overrides,
  };
}

function reset(): void {
  for (const key of Object.keys(mocks.store)) delete mocks.store[key];
  mocks.writes.length = 0;
  notifyEventMock.mockClear();
  resolveEmailMock.mockClear();
  suspendMock.mockClear();
}

beforeEach(() => reset());

describe("checkExpiringEmailServices", () => {
  it("sends the tightest unsent reminder stage and records it in meta", async () => {
    mocks.store.email_services = [serviceRow({ expires_at: daysFromNow(10) })];

    const result = await checkExpiringEmailServices();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notified).toBe(1);

    expect(notifyEventMock).toHaveBeenCalledWith(
      "email.expiring.15",
      expect.objectContaining({ domain: "site.com", daysLeft: expect.any(Number) }),
      expect.objectContaining({ recipients: [{ userId: "user-1", email: "cliente@x.com" }] }),
    );

    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    expect((update?.row.meta as Record<string, unknown>).expiryStageSent).toBe("15");
  });

  it("escalates from an earlier sent stage to a tighter one", async () => {
    mocks.store.email_services = [serviceRow({ expires_at: daysFromNow(3), meta: { expiryStageSent: "30" } })];

    const result = await checkExpiringEmailServices();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(notifyEventMock).toHaveBeenCalledWith("email.expiring.7", expect.anything(), expect.anything());
    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    expect((update?.row.meta as Record<string, unknown>).expiryStageSent).toBe("7");
  });

  it("does not resend an already-sent stage", async () => {
    mocks.store.email_services = [serviceRow({ expires_at: daysFromNow(10), meta: { expiryStageSent: "15" } })];

    const result = await checkExpiringEmailServices();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notified).toBe(0);
    expect(notifyEventMock).not.toHaveBeenCalled();
    expect(mocks.writes.some((w) => w.op === "update" && w.table === "email_services")).toBe(false);
  });

  it("suspends expired active services and notifies the customer", async () => {
    mocks.store.email_services = [serviceRow({ expires_at: daysFromNow(-2) })];

    const result = await checkExpiringEmailServices();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suspended).toBe(1);

    expect(suspendMock).toHaveBeenCalledWith(
      expect.objectContaining({ emailServiceId: SERVICE_ID, reason: expect.any(String) }),
    );
    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    expect(update?.row.status).toBe("suspended");
    expect((update?.row.meta as Record<string, unknown>).expirySuspendedAt).toBeTruthy();
    expect(notifyEventMock).toHaveBeenCalledWith("email.expired", expect.anything(), expect.anything());
  });

  it("skips suspension when the provider fails", async () => {
    suspendMock.mockResolvedValueOnce({ ok: false, message: "provider down" });
    mocks.store.email_services = [serviceRow({ expires_at: daysFromNow(-2) })];

    const result = await checkExpiringEmailServices();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suspended).toBe(0);
    expect(mocks.writes.some((w) => w.op === "update" && w.table === "email_services")).toBe(false);
    expect(notifyEventMock).not.toHaveBeenCalled();
  });

  it("ignores services that are not yet in the window", async () => {
    mocks.store.email_services = [serviceRow({ expires_at: daysFromNow(60) })];

    const result = await checkExpiringEmailServices();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notified).toBe(0);
    expect(notifyEventMock).not.toHaveBeenCalled();
  });
});