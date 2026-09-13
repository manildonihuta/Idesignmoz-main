import { describe, expect, it } from "vitest";

import { getCached, type CacheStore } from "./cache-helpers";

function memoryStore(initial: Record<string, string> = {}): CacheStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    async get(key) {
      return data[key] ?? null;
    },
    async set(key, value, ttlSeconds) {
      data[key] = value;
      expect(ttlSeconds).toBeGreaterThan(0);
    },
    async delete(...keys) {
      for (const key of keys) delete data[key];
    },
  };
}

describe("getCached", () => {
  it("returns cached value without calling the loader again", async () => {
    const store = memoryStore({ "k:1": JSON.stringify({ hello: "world" }) });
    let loads = 0;
    const out = await getCached(store, "k:1", 60, async () => {
      loads += 1;
      return { hello: "cached" };
    });
    expect(out).toEqual({ hello: "world" });
    expect(loads).toBe(0);
    expect(store.data["k:1"]).toBe(JSON.stringify({ hello: "world" }));
  });

  it("loads, stores and returns on cache miss", async () => {
    const store = memoryStore();
    let loads = 0;
    const out = await getCached(store, "k:2", 30, async () => {
      loads += 1;
      return { n: 42 };
    });
    expect(out).toEqual({ n: 42 });
    expect(loads).toBe(1);
    expect(JSON.parse(store.data["k:2"])).toEqual({ n: 42 });
  });

  it("stores null results (negative cache) as the literal null", async () => {
    const store = memoryStore();
    const out = await getCached<string | null>(store, "k:3", 30, async () => null);
    expect(out).toBeNull();
    expect(store.data["k:3"]).toBe("null");
    const second = await getCached<string | null>(store, "k:3", 30, async () => "never");
    expect(second).toBeNull();
  });

  it("falls back to the loader when the store is unavailable", async () => {
    let loads = 0;
    const out = await getCached<string>(null, "k:4", 30, async () => {
      loads += 1;
      return "source";
    });
    expect(out).toBe("source");
    expect(loads).toBe(1);
  });

  it("falls back to the loader on store errors and parse errors", async () => {
    const broken: CacheStore = {
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => undefined,
      delete: async () => undefined,
    };
    const viaBroken = await getCached(broken, "k:5", 30, async () => "ok");
    expect(viaBroken).toBe("ok");

    const corrupt = memoryStore({ "k:6": "not-json{" });
    const viaCorrupt = await getCached(corrupt, "k:6", 30, async () => "recovered");
    expect(viaCorrupt).toBe("recovered");
  });

  it("does not fail the request when storing fails", async () => {
    const store: CacheStore = {
      get: async () => null,
      set: async () => {
        throw new Error("write failed");
      },
      delete: async () => undefined,
    };
    const out = await getCached(store, "k:7", 30, async () => "loaded");
    expect(out).toBe("loaded");
  });
});