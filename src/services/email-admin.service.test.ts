import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: Record<string, Row[]> = {};
  const writes: Array<{ table: string; op: "insert" | "update"; row: Row }> = [];

  const makeChain = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async (): Promise<{ data: Row | null; error: null }> => ({
        data: store[table]?.[0] ?? null,
        error: null,
      }),
      single: async (): Promise<{ data: Row | null; error: null }> => ({
        data: store[table]?.[0] ?? null,
        error: null,
      }),
      then(onfulfilled?: (v: { data: Row[]; error: null }) => unknown): Promise<unknown> {
        return Promise.resolve({ data: store[table] ?? [], error: null }).then(onfulfilled);
      },
      insert: (row: Row) => {
        store[table] = [row, ...(store[table] ?? [])].slice(0, 20);
        writes.push({ table, op: "insert", row });
        return chain;
      },
      update: (row: Row) => {
        const target = store[table]?.[0] ?? {};
        store[table] = [{ ...target, ...row }];
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
        listUsers: vi.fn(async () => ({
          data: { users: [{ id: "user-1", email: "a@b.com" }] },
        })),
      },
    },
  };

  const makeProvider = () => ({
    id: "email-simulated",
    label: "Email Simulado",
    configured: false,
    suspend: vi.fn(async () => ({ ok: true })),
    reactivate: vi.fn(async () => ({ ok: true })),
    refreshMailboxUsage: vi.fn(async () => ({ ok: true, mailboxes: [] as Array<{ emailAddress: string; storageUsedGb: number }> })),
  });

  const selectEmailProvider = vi.fn(() => ({
    provider: makeProvider(),
    mode: "simulated",
  }));

  return { store, writes, db, makeProvider, selectEmailProvider };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: mocks.db }));
vi.mock("@/lib/provisioning/email/registry", () => ({
  selectEmailProvider: mocks.selectEmailProvider,
}));

import {
  adminGetEmailService,
  adminListEmailServices,
  adminSetEmailServiceStatus,
  adminSyncEmailUsage,
} from "@/services/email-admin.service";

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";
const MAILBOX_ID = "22222222-2222-4222-8222-222222222222";

function reset(): void {
  for (const key of Object.keys(mocks.store)) delete mocks.store[key];
  mocks.writes.length = 0;
  mocks.db.auth.admin.listUsers.mockClear();
  mocks.selectEmailProvider.mockReturnValue({
    provider: mocks.makeProvider(),
    mode: "simulated",
  });
}

function serviceRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SERVICE_ID,
    customer_id: "user-1",
    domain: "site.com",
    plan_name: "Email Basic",
    status: "active",
    dns_status: "pending",
    mailbox_limit: 5,
    storage_limit_gb: 5,
    expires_at: null,
    created_at: "2026-01-10T00:00:00Z",
    meta: { provider: "email-simulated", providerMode: "simulated" },
    ...overrides,
  };
}

function mailboxRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: MAILBOX_ID,
    email_service_id: SERVICE_ID,
    email_address: "info@site.com",
    display_name: null,
    status: "active",
    storage_limit_gb: 5,
    storage_used_gb: 0,
    quota_percent: 0,
    accessed_at: null,
    created_at: null,
    forward_to: [],
    autoresponder: null,
    meta: { provider: "email-simulated" },
    provider_mailbox_id: "sim:info@site.com",
    ...overrides,
  };
}

beforeEach(() => reset());

describe("adminListEmailServices", () => {
  it("lists services with aggregated counts and customer identity", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [
      mailboxRow({ email_service_id: SERVICE_ID, status: "active", storage_used_gb: 1 }),
      mailboxRow({ email_service_id: SERVICE_ID, status: "suspended", storage_used_gb: 0.5, id: "x1" }),
      mailboxRow({ email_service_id: SERVICE_ID, status: "deleted", storage_used_gb: 9, id: "x2" }),
    ];
    mocks.store.profiles = [{ id: "user-1", full_name: "Ana" }];

    const result = await adminListEmailServices();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.services).toHaveLength(1);
    const s = result.services[0];
    expect(s.domain).toBe("site.com");
    expect(s.used.mailboxesUsed).toBe(1);
    expect(s.used.storageUsedGb).toBe(1.5);
    expect(s.customerName).toBe("Ana");
    expect(s.customerEmail).toBe("a@b.com");
  });

  it("filters by domain or customer", async () => {
    mocks.store.email_services = [serviceRow(), serviceRow({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", domain: "outro.pt" })];
    mocks.store.email_mailboxes = [];
    mocks.store.profiles = [];

    const result = await adminListEmailServices("outro");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.services).toHaveLength(1);
    expect(result.services[0].domain).toBe("outro.pt");
  });
});

describe("adminGetEmailService", () => {
  it("returns the full service bundle", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [
      mailboxRow({ meta: { passwordChangedAt: "2026-02-01T00:00:00Z" } }),
    ];
    mocks.store.email_aliases = [
      { id: "a1", alias_address: "vendas@site.com", destination: "info@site.com", status: "active", created_at: null },
    ];
    mocks.store.email_usage = [{ storage_used_gb: 3, storage_limit_gb: 5, mailboxes_used: 1, mailboxes_limit: 5, recorded_at: "2026-02-01T10:00:00Z" }];
    mocks.store.email_activity_logs = [{ action: "mailbox.created", actor: "user-1", created_at: "2026-02-01T11:00:00Z" }];
    mocks.store.profiles = [{ id: "user-1", full_name: "Ana" }];

    const result = await adminGetEmailService(SERVICE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { detail } = result;
    expect(detail.service.customerName).toBe("Ana");
    expect(detail.service.customerEmail).toBe("a@b.com");
    expect(detail.mailboxes).toHaveLength(1);
    expect(detail.mailboxes[0].passwordChangedAt).toBe("2026-02-01T00:00:00Z");
    expect(detail.aliases[0].aliasAddress).toBe("vendas@site.com");
    expect(detail.usageHistory).toHaveLength(1);
    expect(detail.usageHistory[0].storageUsedGb).toBe(3);
    expect(detail.usageHistory[0].recordedAt).toBe("2026-02-01T10:00:00Z");
    expect(detail.activity[0].action).toBe("mailbox.created");
    expect(detail.activity[0].actorEmail).toBe("a@b.com");
  });

  it("returns 404 for unknown services", async () => {
    mocks.store.email_services = [];
    const result = await adminGetEmailService(SERVICE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

describe("adminSyncEmailUsage", () => {
  function providerWithUsage(mailboxes: Array<{ emailAddress: string; storageUsedGb: number }>) {
    const provider = mocks.makeProvider();
    provider.refreshMailboxUsage.mockResolvedValue({ ok: true, mailboxes });
    return provider;
  }

  it("updates mailboxes, appends a snapshot and logs activity", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [
      mailboxRow({ email_address: "info@site.com" }),
      mailboxRow({ id: "x1", email_address: "vendas@site.com" }),
    ];
    mocks.selectEmailProvider.mockReturnValue({
      provider: providerWithUsage([{ emailAddress: "info@site.com", storageUsedGb: 1.5 }]),
      mode: "simulated",
    });

    const result = await adminSyncEmailUsage(SERVICE_ID, { userId: "admin-1", email: "admin@x.com", role: "admin" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.usage.storageUsedGb).toBe(1.5);
    expect(result.usage.mailboxesUsed).toBe(2);
    expect(mocks.writes.some((w) => w.op === "update" && w.table === "email_mailboxes" && w.row.storage_used_gb === 1.5)).toBe(true);
    const snapshot = mocks.writes.find((w) => w.op === "insert" && w.table === "email_usage");
    expect(snapshot?.row.storage_used_gb).toBe(1.5);
    expect(snapshot?.row.mailboxes_used).toBe(2);
    expect(mocks.writes.some((w) => w.table === "email_activity_logs")).toBe(true);
  });

  it("rejects inactive services", async () => {
    mocks.store.email_services = [serviceRow({ status: "provisioning" })];
    const result = await adminSyncEmailUsage(SERVICE_ID, { userId: "admin-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });
});

describe("adminSetEmailServiceStatus", () => {
  it("suspends and reactivates a service via the provider", async () => {
    mocks.store.email_services = [serviceRow()];

    const suspended = await adminSetEmailServiceStatus(SERVICE_ID, "suspend", { userId: "admin-1" });
    expect(suspended.ok).toBe(true);
    if (!suspended.ok) return;
    expect(suspended.service.status).toBe("suspended");

    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_services");
    expect(update?.row.status).toBe("suspended");

    const provider = mocks.selectEmailProvider.mock.results[0].value.provider;
    expect(provider.suspend).toHaveBeenCalledWith(
      expect.objectContaining({ emailServiceId: SERVICE_ID, domain: "site.com" }),
    );

    const reactivated = await adminSetEmailServiceStatus(SERVICE_ID, "resume", { userId: "admin-1" });
    expect(reactivated.ok).toBe(true);
    if (reactivated.ok) expect(reactivated.service.status).toBe("active");
  });

  it("rejects a status that is already applied", async () => {
    mocks.store.email_services = [serviceRow({ status: "suspended" })];
    const result = await adminSetEmailServiceStatus(SERVICE_ID, "suspend", { userId: "admin-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });
});