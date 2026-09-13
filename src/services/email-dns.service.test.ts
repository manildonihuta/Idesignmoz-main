import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: Record<string, Row[]> = {};

  const filterRows = (table: string, filters: Array<[string, unknown]>): Row[] =>
    (store[table] ?? []).filter((row) => filters.every(([key, value]) => row[key] === value));

  const makeChain = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let pending: "insert" | "update" | null = null;
    let pendingRow: Row | null = null;

    const apply = (): void => {
      if (!pending || !pendingRow) return;
      if (pending === "insert") {
        const withId = pendingRow.id ? pendingRow : { ...pendingRow, id: `row-${(store[table] ?? []).length}-${table}` };
        store[table] = [withId, ...(store[table] ?? [])];
      } else {
        for (const target of filterRows(table, filters)) Object.assign(target, pendingRow);
      }
      pending = null;
      pendingRow = null;
    };

    const resolveData = () => {
      apply();
      return { data: filterRows(table, filters), error: null };
    };

    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => {
        filters.push([key, value]);
        return chain;
      },
      not: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      then(onfulfilled?: (v: { data: Row[]; error: null }) => unknown): Promise<unknown> {
        return Promise.resolve(resolveData()).then(onfulfilled);
      },
      maybeSingle: async (): Promise<{ data: Row | null; error: null }> => ({
        data: resolveData().data[0] ?? null,
        error: null,
      }),
      single: async (): Promise<{ data: Row | null; error: null }> => ({
        data: resolveData().data[0] ?? null,
        error: null,
      }),
      insert: (row: Row) => {
        pending = "insert";
        pendingRow = row;
        return chain;
      },
      update: (row: Row) => {
        pending = "update";
        pendingRow = row;
        return chain;
      },
    };
    return chain;
  };

  const db = {
    from: (table: string) => makeChain(table),
  };

  return { store, db };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: mocks.db }));
vi.mock("@/lib/provisioning/email/registry", () => ({
  selectEmailProvider: () => ({ provider: { id: "email-simulated" }, mode: "simulated" }),
}));

import {
  getEmailDnsConfigs,
  verifyEmailDns,
} from "@/services/email-dns.service";
import { buildEmailDnsRecords } from "@/lib/email/dns-records";
import type { AuthContext } from "@/lib/client";

const ctx: AuthContext & { userId: string; email: string } = {
  authenticated: true,
  userId: "user-1",
  email: "a@b.com",
};

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";

function reset(): void {
  for (const key of Object.keys(mocks.store)) delete mocks.store[key];
  mocks.store.email_services = [
    {
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
      meta: { provider: "email-simulated", providerMode: "simulated" },
    },
  ];
}

beforeEach(() => reset());

describe("buildEmailDnsRecords", () => {
  it("generates the four recommended email records", () => {
    const records = buildEmailDnsRecords("Site.com");
    expect(records.map((r) => r.recordType)).toEqual(["mx", "spf", "dkim", "dmarc"]);

    const mx = records.find((r) => r.recordType === "mx")!;
    expect(mx.value.type).toBe("MX");
    expect(mx.value.priority).toBe(10);
    expect(mx.value.value).toMatch(/^mx\d/);
    expect(mx.value.name).toBe("@");

    const spf = records.find((r) => r.recordType === "spf")!;
    expect(spf.value.type).toBe("TXT");
    expect(spf.value.value).toMatch(/^v=spf1 /);

    const dkim = records.find((r) => r.recordType === "dkim")!;
    expect(dkim.selector).toBe("default");
    expect(dkim.value.name).toBe("default._domainkey");
    expect(dkim.value.value).toMatch(/^v=DKIM1; k=rsa; p=/);

    const dmarc = records.find((r) => r.recordType === "dmarc")!;
    expect(dmarc.value.name).toBe("_dmarc");
    expect(dmarc.value.value).toMatch(/^v=DMARC1; p=none/);
    expect(dmarc.value.value).toContain("mailto:dmarc@site.com");
  });

  it("is deterministic for a given domain", () => {
    const [a, b] = [buildEmailDnsRecords("site.com"), buildEmailDnsRecords("site.com")];
    expect(a).toEqual(b);
    const dkimA = a.find((r) => r.recordType === "dkim")!.value.value;
    expect(buildEmailDnsRecords("other.com").find((r) => r.recordType === "dkim")!.value.value).not.toBe(dkimA);
  });
});

describe("getEmailDnsConfigs", () => {
  it("returns the stored service dnsStatus and seeds recommended records", async () => {
    const result = await getEmailDnsConfigs(ctx, SERVICE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.service.dnsStatus).toBe("pending");
    expect(result.service.domain).toBe("site.com");
    expect(result.records).toHaveLength(4);
    expect(result.records.map((r) => r.recordType).sort()).toEqual(["dkim", "dmarc", "mx", "spf"]);
    expect(result.records.every((r) => r.status === "pending")).toBe(true);
    expect(result.records.every((r) => r.value)).toBe(true);

    const stored = mocks.store.email_dns_configs ?? [];
    expect(stored).toHaveLength(4);
    expect(stored.every((r) => r.email_service_id === SERVICE_ID)).toBe(true);
  });

  it("does not duplicate records on repeated calls", async () => {
    await getEmailDnsConfigs(ctx, SERVICE_ID);
    await getEmailDnsConfigs(ctx, SERVICE_ID);
    expect(mocks.store.email_dns_configs ?? []).toHaveLength(4);
  });

  it("rejects services owned by another account", async () => {
    mocks.store.email_services[0] = { ...mocks.store.email_services[0], customer_id: "user-2" };
    const result = await getEmailDnsConfigs(ctx, SERVICE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("rejects unknown identifiers", async () => {
    const result = await getEmailDnsConfigs(ctx, "00000000-0000-4000-8000-000000000000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

describe("verifyEmailDns", () => {
  const allGood: (name: string, type: string) => Promise<string[]> = async (name, type) => {
    if (type === "MX") return ["10 mx10.mail.idesignmoz.com."];
    if (name.includes("_domainkey")) return ['"v=DKIM1; k=rsa; p=AAA"'];
    if (name.startsWith("_dmarc")) return ['"v=DMARC1; p=none; rua=mailto:dmarc@site.com"'];
    return ['"v=spf1 include:idesignmoz.com ~all"'];
  };

  it("marks every record verified when DNS resolves correctly", async () => {
    const result = await verifyEmailDns(ctx, SERVICE_ID, allGood);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.service.dnsStatus).toBe("verified");
    expect(result.records.every((r) => r.status === "verified")).toBe(true);
    expect(result.records.every((r) => r.lastCheckedAt)).toBe(true);
    const service = mocks.store.email_services?.[0];
    expect(service?.dns_status).toBe("verified");
  });

  it("keeps verifying status when only part of the records resolve", async () => {
    const partial: (name: string, type: string) => Promise<string[]> = async (name, type) => {
      if (type === "MX") return ["10 mx10.mail.idesignmoz.com."];
      return [];
    };
    const result = await verifyEmailDns(ctx, SERVICE_ID, partial);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.service.dnsStatus).toBe("verifying");
    const verified = result.records.filter((r) => r.status === "verified");
    const failed = result.records.filter((r) => r.status === "failed");
    expect(verified.map((r) => r.recordType)).toEqual(["mx"]);
    expect(failed.map((r) => r.recordType).sort()).toEqual(["dkim", "dmarc", "spf"]);
  });

  it("marks the service as failed when no record resolves", async () => {
    const none: (name: string, type: string) => Promise<string[]> = async () => [];
    const result = await verifyEmailDns(ctx, SERVICE_ID, none);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.service.dnsStatus).toBe("failed");
    expect(result.records.every((r) => r.status === "failed")).toBe(true);
  });

  it("requires the service owner", async () => {
    mocks.store.email_services[0] = { ...mocks.store.email_services[0], customer_id: "user-2" };
    const result = await verifyEmailDns(ctx, SERVICE_ID, allGood);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});