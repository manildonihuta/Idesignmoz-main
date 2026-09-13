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
  };

  const makeProvider = () => ({
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
    createAlias: vi.fn(async (req: Record<string, unknown>) => ({
      ok: true,
      providerAliasId: req.aliasAddress,
    })),
    deleteAlias: vi.fn(async () => ({ ok: true })),
    setForwarding: vi.fn(async () => ({ ok: true })),
    setAutoresponder: vi.fn(async () => ({ ok: true })),
    setPassword: vi.fn(async (): Promise<MailboxPasswordResult> => ({ ok: true })),
    refreshMailboxUsage: vi.fn(async (): Promise<MailboxUsageResult> => ({ ok: true, mailboxes: [] })),
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
  createAlias,
  aliasAction,
  setMailboxForwarding,
  setMailboxAutoresponder,
  createMailbox,
  getEmailServiceDetail,
  mailboxAction,
  resetMailboxPassword,
  syncEmailUsage,
} from "@/services/email.service";
import type { AuthContext } from "@/lib/client";
import type { MailboxPasswordResult, MailboxUsageResult } from "@/lib/provisioning/email/types";

const ctx: AuthContext & { userId: string; email: string } = {
  authenticated: true,
  userId: "user-1",
  email: "a@b.com",
};

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";
const MAILBOX_ID = "22222222-2222-4222-8222-222222222222";
const ALIAS_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER = "99999999-9999-4999-8999-999999999999";

function reset(): void {
  for (const key of Object.keys(mocks.store)) delete mocks.store[key];
  mocks.writes.length = 0;
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
    provider_email_id: "sim:site.com",
    provider_status: "active",
    meta: { provider: "email-simulated", providerMode: "simulated" },
    ...overrides,
  };
}

function mailboxRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: MAILBOX_ID,
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
    provider_mailbox_id: "sim:info@site.com",
    meta: { provider: "email-simulated" },
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
    mocks.store.email_mailboxes = [mailboxRow()];
    mocks.store.email_aliases = [];
    const result = await getEmailServiceDetail(ctx, SERVICE_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.service.domain).toBe("site.com");
      expect(result.service.mailboxes).toHaveLength(1);
      expect(result.service.mailboxes[0].emailAddress).toBe("info@site.com");
    }
  });

  it("returns aliases and mailbox forwarding/autoresponder", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [
      mailboxRow({ forward_to: ["dest@x.com"], autoresponder: { enabled: true, subject: "Oi", body: "Alo" } }),
    ];
    mocks.store.email_aliases = [
      { id: ALIAS_ID, alias_address: "vendas@site.com", destination: "info@site.com", status: "active", created_at: "2026-01-01T00:00:00Z" },
    ];
    mocks.store.email_usage = [];

    const result = await getEmailServiceDetail(ctx, SERVICE_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.service.aliases).toHaveLength(1);
      expect(result.service.aliases[0].aliasAddress).toBe("vendas@site.com");
      expect(result.service.mailboxes[0].forwardTo).toEqual(["dest@x.com"]);
      expect(result.service.mailboxes[0].autoresponder?.enabled).toBe(true);
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
    mocks.store.email_mailboxes = [mailboxRow()];

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

  it("soft-deletes aliases pointing to a removed mailbox", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow({ email_address: "info@site.com" })];
    mocks.store.email_aliases = [
      { id: ALIAS_ID, alias_address: "vendas@site.com", destination: "info@site.com", status: "active" },
    ];

    const result = await mailboxAction(ctx, SERVICE_ID, MAILBOX_ID, "delete");
    expect(result.ok).toBe(true);
    expect(mocks.writes.some((w) => w.table === "email_aliases" && w.op === "update" && w.row.status === "deleted")).toBe(true);
  });
});

describe("createAlias", () => {
  it("rejects when service is not owned or active", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: OTHER_USER })];
    expect((await createAlias(ctx, SERVICE_ID, { localPart: "vendas", destination: "info@site.com" })).ok).toBe(false);

    reset();
    mocks.store.email_services = [serviceRow({ status: "provisioning" })];
    expect((await createAlias(ctx, SERVICE_ID, { localPart: "vendas", destination: "info@site.com" })).ok).toBe(false);
  });

  it("rejects invalid local part and invalid destination", async () => {
    mocks.store.email_services = [serviceRow()];
    expect((await createAlias(ctx, SERVICE_ID, { localPart: "", destination: "info@site.com" })).ok).toBe(false);
    expect((await createAlias(ctx, SERVICE_ID, { localPart: "vendas", destination: "not-an-email" })).ok).toBe(false);
  });

  it("rejects self-loop, duplicate alias and mailbox collision", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [];
    mocks.store.email_aliases = [];
    expect((await createAlias(ctx, SERVICE_ID, { localPart: "info", destination: "info@site.com" })).ok).toBe(false);

    mocks.store.email_aliases = [{ id: ALIAS_ID, alias_address: "vendas@site.com", status: "active" }];
    expect((await createAlias(ctx, SERVICE_ID, { localPart: "vendas", destination: "x@site.com" })).ok).toBe(false);

    reset();
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow({ email_address: "vendas@site.com" })];
    expect((await createAlias(ctx, SERVICE_ID, { localPart: "vendas", destination: "x@site.com" })).ok).toBe(false);
  });

  it("creates alias and calls the provider", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [];
    mocks.store.email_aliases = [];

    const result = await createAlias(ctx, SERVICE_ID, { localPart: "vendas", destination: "info@site.com" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alias.aliasAddress).toBe("vendas@site.com");
      expect(result.alias.destination).toBe("info@site.com");
    }

    const provider = mocks.selectEmailProvider.mock.results[0].value.provider;
    expect(provider.createAlias).toHaveBeenCalledWith(
      expect.objectContaining({ aliasAddress: "vendas@site.com", destination: "info@site.com" }),
    );

    const insert = mocks.writes.find((w) => w.op === "insert" && w.table === "email_aliases");
    expect(insert?.row.alias_address).toBe("vendas@site.com");
    expect(insert?.row.destination).toBe("info@site.com");
    expect(insert?.row).not.toHaveProperty("password");

    expect(mocks.writes.some((w) => w.table === "email_activity_logs")).toBe(true);
  });
});

describe("aliasAction delete", () => {
  it("soft-deletes the alias", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_aliases = [
      { id: ALIAS_ID, alias_address: "vendas@site.com", destination: "info@site.com", status: "active" },
    ];

    const result = await aliasAction(ctx, SERVICE_ID, ALIAS_ID);
    expect(result.ok).toBe(true);
    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_aliases");
    expect(update?.row.status).toBe("deleted");
  });

  it("rejects non-owned service and already deleted alias", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: OTHER_USER })];
    mocks.store.email_aliases = [{ id: ALIAS_ID, status: "active" }];
    expect((await aliasAction(ctx, SERVICE_ID, ALIAS_ID)).ok).toBe(false);

    reset();
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_aliases = [{ id: ALIAS_ID, status: "deleted" }];
    expect((await aliasAction(ctx, SERVICE_ID, ALIAS_ID)).ok).toBe(false);
  });
});

describe("setMailboxForwarding", () => {
  it("rejects invalid emails, self-loop, and limit", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow()];

    expect((await setMailboxForwarding(ctx, SERVICE_ID, MAILBOX_ID, { forwardTo: ["bad"] })).ok).toBe(false);
    expect((await setMailboxForwarding(ctx, SERVICE_ID, MAILBOX_ID, { forwardTo: ["info@site.com"] })).ok).toBe(false);
    expect(
      (
        await setMailboxForwarding(ctx, SERVICE_ID, MAILBOX_ID, {
          forwardTo: ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com", "g@x.com", "h@x.com", "i@x.com", "j@x.com", "k@x.com"],
        })
      ).ok,
    ).toBe(false);
  });

  it("saves forwarding destinations and calls provider", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow()];

    const result = await setMailboxForwarding(ctx, SERVICE_ID, MAILBOX_ID, {
      forwardTo: ["dest1@example.com", "Dest2@example.com"],
    });
    expect(result.ok).toBe(true);

    const provider = mocks.selectEmailProvider.mock.results[0].value.provider;
    expect(provider.setForwarding).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: "info@site.com" }),
      ["dest1@example.com", "dest2@example.com"],
    );

    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_mailboxes");
    expect(update?.row.forward_to).toEqual(["dest1@example.com", "dest2@example.com"]);
  });

  it("clears forwarding with an empty array", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow({ forward_to: ["old@x.com"] })];

    const result = await setMailboxForwarding(ctx, SERVICE_ID, MAILBOX_ID, { forwardTo: [] });
    expect(result.ok).toBe(true);
    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_mailboxes");
    expect(update?.row.forward_to).toEqual([]);
  });
});

describe("setMailboxAutoresponder", () => {
  it("rejects enabled autoresponder without subject or body", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow()];

    expect(
      (await setMailboxAutoresponder(ctx, SERVICE_ID, MAILBOX_ID, { enabled: true, subject: "", body: "hi" })).ok,
    ).toBe(false);
    expect(
      (await setMailboxAutoresponder(ctx, SERVICE_ID, MAILBOX_ID, { enabled: true, subject: "Assunto", body: "" })).ok,
    ).toBe(false);
  });

  it("enables autoresponder and calls provider", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow()];

    const result = await setMailboxAutoresponder(ctx, SERVICE_ID, MAILBOX_ID, {
      enabled: true,
      subject: "Fora de escritório",
      body: "Estou ausente.",
      fromName: "Info",
    });
    expect(result.ok).toBe(true);

    const provider = mocks.selectEmailProvider.mock.results[0].value.provider;
    expect(provider.setAutoresponder).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: "info@site.com" }),
      expect.objectContaining({ subject: "Fora de escritório", body: "Estou ausente.", fromName: "Info" }),
    );

    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_mailboxes");
    expect(update?.row.autoresponder).toMatchObject({ enabled: true, subject: "Fora de escritório" });
  });

  it("disables autoresponder and clears config", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow({ autoresponder: { enabled: true, subject: "x", body: "y" } })];

    const result = await setMailboxAutoresponder(ctx, SERVICE_ID, MAILBOX_ID, { enabled: false });
    expect(result.ok).toBe(true);

    const provider = mocks.selectEmailProvider.mock.results[0].value.provider;
    expect(provider.setAutoresponder).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: "info@site.com" }),
      null,
    );

    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_mailboxes");
    expect(update?.row.autoresponder).toBeNull();
  });
});

describe("resetMailboxPassword", () => {
  it("rejects non-owned, inactive service, suspended mailbox and weak password", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: OTHER_USER })];
    mocks.store.email_mailboxes = [mailboxRow()];
    expect((await resetMailboxPassword(ctx, SERVICE_ID, MAILBOX_ID, { password: "longenough1" })).ok).toBe(false);

    reset();
    mocks.store.email_services = [serviceRow({ status: "provisioning" })];
    mocks.store.email_mailboxes = [mailboxRow()];
    expect((await resetMailboxPassword(ctx, SERVICE_ID, MAILBOX_ID, { password: "longenough1" })).ok).toBe(false);

    reset();
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow({ status: "suspended" })];
    expect((await resetMailboxPassword(ctx, SERVICE_ID, MAILBOX_ID, { password: "longenough1" })).ok).toBe(false);

    reset();
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow()];
    expect((await resetMailboxPassword(ctx, SERVICE_ID, MAILBOX_ID, { password: "short" })).ok).toBe(false);
  });

  it("resets the password at the provider and stores only the change timestamp", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow()];

    const result = await resetMailboxPassword(ctx, SERVICE_ID, MAILBOX_ID, { password: "newpass123" });
    expect(result.ok).toBe(true);

    const provider = mocks.selectEmailProvider.mock.results[0].value.provider;
    expect(provider.setPassword).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: "info@site.com", domain: "site.com" }),
      "newpass123",
    );

    const update = mocks.writes.find((w) => w.op === "update" && w.table === "email_mailboxes");
    expect(update?.row.meta).toMatchObject({ passwordChangedAt: expect.any(String) });

    const touched = mocks.writes.filter((w) => w.table === "email_mailboxes");
    expect(touched.some((w) => "password" in (w.row as Record<string, unknown>))).toBe(false);

    if (result.ok) {
      expect(result.mailbox.passwordChangedAt).toBeTruthy();
    }
  });
});

describe("syncEmailUsage", () => {
  function providerWithUsage(mailboxes: Array<{ emailAddress: string; storageUsedGb: number }>) {
    const provider = mocks.makeProvider();
    provider.refreshMailboxUsage.mockResolvedValue({ ok: true, mailboxes });
    return provider;
  }

  it("rejects non-owned or inactive service", async () => {
    mocks.store.email_services = [serviceRow({ customer_id: OTHER_USER })];
    expect((await syncEmailUsage(ctx, SERVICE_ID)).ok).toBe(false);

    reset();
    mocks.store.email_services = [serviceRow({ status: "provisioning" })];
    expect((await syncEmailUsage(ctx, SERVICE_ID)).ok).toBe(false);
  });

  it("updates per-mailbox usage, appends a snapshot and exposes history", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [
      mailboxRow({ id: MAILBOX_ID, email_address: "info@site.com" }),
      mailboxRow({
        id: "44444444-4444-4444-8444-444444444444",
        email_address: "vendas@site.com",
        storage_limit_gb: 5,
      }),
    ];
    mocks.store.email_usage = [];
    mocks.selectEmailProvider.mockReturnValue({
      provider: providerWithUsage([
        { emailAddress: "info@site.com", storageUsedGb: 1.5 },
        { emailAddress: "VENDAS@site.com", storageUsedGb: 2.25 },
      ]),
      mode: "simulated",
    });

    const result = await syncEmailUsage(ctx, SERVICE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updates = mocks.writes.filter((w) => w.op === "update" && w.table === "email_mailboxes");
    expect(updates).toHaveLength(2);
    expect(updates.some((u) => u.row.storage_used_gb === 1.5 && u.row.quota_percent === 30)).toBe(true);
    expect(updates.some((u) => u.row.storage_used_gb === 2.25 && u.row.quota_percent === 45)).toBe(true);

    const snapshot = mocks.writes.find((w) => w.op === "insert" && w.table === "email_usage");
    expect(snapshot).toBeDefined();
    expect(snapshot?.row.storage_used_gb).toBe(3.75);
    expect(snapshot?.row.mailboxes_used).toBe(2);
    expect(snapshot?.row.mailboxes_limit).toBe(5);

    expect(result.usage.storageUsedGb).toBe(3.75);
    expect(result.usage.mailboxesUsed).toBe(2);
    expect(result.usage.recordedAt).toBeTruthy();
  });

  it("propagates provider failures", async () => {
    mocks.store.email_services = [serviceRow()];
    mocks.store.email_mailboxes = [mailboxRow()];
    mocks.store.email_usage = [];
    const provider = mocks.makeProvider();
    provider.refreshMailboxUsage.mockResolvedValue({ ok: false, message: "WHM offline", mailboxes: [] });
    mocks.selectEmailProvider.mockReturnValue({ provider, mode: "live" });

    const result = await syncEmailUsage(ctx, SERVICE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toContain("WHM");
    }
  });
});
