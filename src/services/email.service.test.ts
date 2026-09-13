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
        store[table] = [row, ...(store[table] ?? [])].slice(0, 5);
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
  };

  const selectEmailProvider = vi.fn(() => ({
    provider: {
      id: "email-simulated",
      label: "Email Simulado",
      configured: false,
      createMailbox: vi.fn(async (req: Record<string, unknown>) => ({
        ok: true,
        providerMailboxId: req.emailAddress,
      })),
      suspendMailbox: vi.fn(async () => ({ ok: true })),
      reactivateMailbox: vi.fn(async () => ({ ok: true })),
      deleteMailbox: vi.fn(async () => ({ ok: true })),
    },
    mode: "simulated",
  }));

  return { store, writes, makeChain, db, selectEmailProvider };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: mocks.db }));
vi.mock("@/lib/provisioning/email/registry", () => ({
  selectEmailProvider: mocks.selectEmailProvider,
}));

import { createMailbox, getEmailServiceDetail, mailboxAction } from "@/services/email.service";
import type { AuthContext } from "@/lib/client";

const ctx: AuthContext & { userId: string; email: string } = {
  authenticated: true,
  userId: "user-1",
  email: "a@b.com",
};

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";
const MAILBOX_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER = "99999999-9999-4999-8999-999999999999";

function reset(): void {
  for (const key of Object.keys(mocks.store)) delete mocks.store[key];
  mocks.writes.length = 0;
  mocks.selectEmailProvider.mockReturnValue({
    provider: {
      id: "email-simulated",
      label: "Email Simulado",
      configured: false,
      createMailbox: vi.fn(async (req: Record<string, unknown>) => ({ ok: true, providerMailboxId: req.emailAddress })),
      suspendMailbox: vi.fn(async () => ({ ok: true })),
      reactivateMailbox: vi.fn(async () => ({ ok: true })),
      deleteMailbox: vi.fn(async () => ({ ok: true })),
    },
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
    provider_email_id: "sim:site.com",
    provider_status: "active",
    meta: { provider: "email-simulated", providerMode: "simulated" },
    ...overrides,
  };
}

beforeEach(() => reset());

describe("getEmailServiceDetail", () => {
  it("returns 403 when the service belongs to another customer", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: OTHER_USER })];
    const result = await getEmailServiceDetail(ctx, SERVICE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("returns the service with its mailboxes", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [
      { id: MAILBOX_ID, email_address: "info@site.com", display_name: null, status: "active", storage_limit_gb: 5, storage_used_gb: 0, quota_percent: 0, accessed_at: null, created_at: null },
    ];
    const result = await getEmailServiceDetail(ctx, SERVICE_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.service.domain).toBe("site.com");
      expect(result.service.mailboxes).toHaveLength(1);
      expect(result.service.mailboxes[0].emailAddress).toBe("info@site.com");
    }
  });
});

describe("createMailbox", () => {
  it("rejects invalid local part and weak password", async () => {
    mocks.store.email_services = [serviceRow()];
    const bad = await createMailbox(ctx, SERVICE_ID, { localPart: "in valid", password: "secret" });
    expect(bad.ok).toBe(false);
    const weak = await createMailbox(ctx, SERVICE_ID, { localPart: "info", password: "short" });
    expect(weak.ok).toBe(false);
  });

  it("rejects when the service is not owned", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: OTHER_USER })];
    const result = await createMailbox(ctx, SERVICE_ID, { localPart: "info", password: "longenough1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("rejects when the mailbox limit is reached", async () => {
    mocks.store.email_services = [serviceRow({ mailbox_limit: 2 })];
    mocks.store.email_mailboxes = [{ status: "active" }, { status: "active" }];
    const result = await createMailbox(ctx, SERVICE_ID, { localPart: "info", password: "longenough1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("rejects duplicate email addresses", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [{ id: "1", email_address: "info@site.com", status: "active" }];
    const result = await createMailbox(ctx, SERVICE_ID, { localPart: "info", password: "longenough1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("creates an active mailbox and never stores the password", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [];

    const result = await createMailbox(ctx, SERVICE_ID, {
      localPart: "Info",
      displayName: "Informações",
      password: "longenough1",
    });
    expect(result.ok).toBe(true);

    const provider = mocks.selectEmailProvider.mock.results[0].value.provider;
    expect(provider.createMailbox).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: "info@site.com",
        domain: "site.com",
        quotaGb: 5,
        password: "longenough1",
      }),
    );

    const insert = mocks.writes.find((w) => w.op === "insert" && w.table === "email_mailboxes");
    expect(insert).toBeDefined();
    expect(insert?.row.email_address).toBe("info@site.com");
    expect(insert?.row.status).toBe("active");
    expect(insert?.row.storage_limit_gb).toBe(5);
    expect(insert?.row).not.toHaveProperty("password");

    if (result.ok) {
      expect(result.mailbox.emailAddress).toBe("info@site.com");
    }
  });
});

describe("mailboxAction", () => {
  it("suspends a mailbox owned by the customer", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [
      { id: MAILBOX_ID, email_address: "info@site.com", display_name: null, status: "active", storage_limit_gb: 5, storage_used_gb: 0, quota_percent: 0, accessed_at: null, created_at: null, provider_mailbox_id: "x" },
    ];

    const result = await mailboxAction(ctx, SERVICE_ID, MAILBOX_ID, "suspend");
    expect(result.ok).toBe(true);
    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_mailboxes");
    expect(update?.row.status).toBe("suspended");
    if (result.ok) expect(result.mailbox.status).toBe("suspended");
  });

  it("forbids acting on another customer's service", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: OTHER_USER })];
    mocks.store.email_mailboxes = [{ id: MAILBOX_ID, status: "active" }];
    const result = await mailboxAction(ctx, SERVICE_ID, MAILBOX_ID, "delete");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
