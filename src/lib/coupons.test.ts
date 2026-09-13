import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: {} }));

import { usable } from "@/lib/coupons";
import type { CouponRow } from "@/lib/coupons";

function row(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    id: "c1",
    code: "WELCOME",
    kind: "percent",
    value: 10,
    min_subtotal: 0,
    max_discount: null,
    max_uses: null,
    used_count: 0,
    valid_from: null,
    valid_until: null,
    active: true,
    ...overrides,
  };
}

describe("usable", () => {
  it("accepts an active, valid coupon", () => {
    expect(usable(row(), 10000)).toBeNull();
  });

  it("rejects inactive coupons", () => {
    expect(usable(row({ active: false }), 10000)).toBe("Este cupão já não está ativo.");
  });

  it("rejects coupons that are not yet valid", () => {
    expect(usable(row({ valid_from: new Date(Date.now() + 86400000).toISOString() }), 10000)).toBe(
      "Este cupão ainda não está ativo.",
    );
  });

  it("rejects expired coupons", () => {
    expect(usable(row({ valid_until: new Date(Date.now() - 86400000).toISOString() }), 10000)).toBe(
      "Este cupão expirou.",
    );
  });

  it("rejects coupons past max uses", () => {
    expect(usable(row({ max_uses: 5, used_count: 5 }), 10000)).toBe("Este cupão atingiu o limite de utilizações.");
  });

  it("rejects subtotal below minimum", () => {
    expect(usable(row({ min_subtotal: 20000 }), 15000)).toBe("Este cupão exige um mínimo de 20000 MT.");
  });

  it("accepts exactly at minimum", () => {
    expect(usable(row({ min_subtotal: 20000 }), 20000)).toBeNull();
  });
});