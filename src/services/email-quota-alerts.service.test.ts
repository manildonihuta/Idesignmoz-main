import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: Record<string, Row[]> = {};
  const writes: Array<{ table: string; op: "insert" | "update"; row: Row }> = [];

  const makeChain = (table: string) => {
    const chain = {
      then(onfulfilled?: (v: { data: Row[]; error: null }) => unknown): Promise<unknown> {
        return Promise.resolve({ data: store[table] ?? [], error: null }).then(onfulfilled);
      },
      update: (row: Row) => {
        store[table] = [row];
        writes.push({ table, op: "update", row });
        return chain;
      },
      eq: () => chain,
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

const notifyEventMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, sent: 1, failed: 0 })));
const resolveEmailMock = vi.hoisted(() => vi.fn(async () => "cliente@x.com"));

import { evaluateEmailQuotaAlerts } from "@/services/email-quota-alerts.service";

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";

function reset(): void {
  for (const key of Object.keys(mocks.store)) delete mocks.store[key];
  mocks.writes.length = 0;
  notifyEventMock.mockClear();
  resolveEmailMock.mockClear();
}

beforeEach(() => reset());

describe("evaluateEmailQuotaAlerts", () => {
  it("fires the 80% alert once when crossing the threshold", async () => {
    await evaluateEmailQuotaAlerts({
      serviceId: SERVICE_ID,
      customerId: "user-1",
      domain: "site.com",
      meta: null,
      storageLimitGb: 5,
      storageUsedGb: 4.1,
    });

    expect(notifyEventMock).toHaveBeenCalledTimes(1);
    expect(notifyEventMock).toHaveBeenCalledWith(
      "email.quota.80",
      expect.objectContaining({ domain: "site.com", percent: 82 }),
      expect.objectContaining({ recipients: [{ userId: "user-1", email: "cliente@x.com" }] }),
    );

    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    expect(update?.row.meta).toMatchObject({ quotaAlertSent80: true });
    expect(typeof (update?.row.meta as Record<string, unknown>).quotaAlertSent80At).toBe("string");
    expect((update?.row.meta as Record<string, unknown>).quotaAlertSent95).toBeUndefined();
  });

  it("fires both 80% and 95% alerts when usage is critical", async () => {
    await evaluateEmailQuotaAlerts({
      serviceId: SERVICE_ID,
      customerId: "user-1",
      domain: "site.com",
      meta: null,
      storageLimitGb: 5,
      storageUsedGb: 4.8,
    });

    expect(notifyEventMock).toHaveBeenCalledTimes(2);
    expect(notifyEventMock).toHaveBeenCalledWith("email.quota.80", expect.anything(), expect.anything());
    expect(notifyEventMock).toHaveBeenCalledWith("email.quota.95", expect.anything(), expect.anything());
  });

  it("does not re-alert while the flag is already set", async () => {
    await evaluateEmailQuotaAlerts({
      serviceId: SERVICE_ID,
      customerId: "user-1",
      domain: "site.com",
      meta: { quotaAlertSent80: true },
      storageLimitGb: 5,
      storageUsedGb: 4.5,
    });

    expect(notifyEventMock).not.toHaveBeenCalled();
    expect(mocks.writes.some((w) => w.op === "update" && w.table === "email_services")).toBe(false);
  });

  it("clears the alert flag when usage drops below the threshold", async () => {
    await evaluateEmailQuotaAlerts({
      serviceId: SERVICE_ID,
      customerId: "user-1",
      domain: "site.com",
      meta: { quotaAlertSent80: true, quotaAlertSent80At: "2026-01-01T00:00:00Z" },
      storageLimitGb: 5,
      storageUsedGb: 2,
    });

    expect(notifyEventMock).not.toHaveBeenCalled();
    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    const meta = update?.row.meta as Record<string, unknown>;
    expect(meta.quotaAlertSent80).toBeUndefined();
    expect(meta.quotaAlertSent80At).toBeUndefined();
  });

  it("does nothing below all thresholds", async () => {
    await evaluateEmailQuotaAlerts({
      serviceId: SERVICE_ID,
      customerId: "user-1",
      domain: "site.com",
      meta: null,
      storageLimitGb: 5,
      storageUsedGb: 1,
    });

    expect(notifyEventMock).not.toHaveBeenCalled();
    expect(mocks.writes.some((w) => w.op === "update" && w.table === "email_services")).toBe(false);
  });
});