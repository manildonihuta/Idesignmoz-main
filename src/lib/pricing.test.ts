import { describe, expect, it } from "vitest";

import { computeTotals, couponDiscount } from "@/lib/pricing";

describe("couponDiscount", () => {
  it("applies percent off", () => {
    expect(couponDiscount({ kind: "percent", value: 10 }, 10000)).toBe(1000);
  });

  it("applies fixed discount", () => {
    expect(couponDiscount({ kind: "fixed", value: 2500 }, 10000)).toBe(2500);
  });

  it("caps at maxDiscount", () => {
    expect(couponDiscount({ kind: "percent", value: 50, maxDiscount: 2000 }, 10000)).toBe(2000);
  });

  it("never exceeds subtotal", () => {
    expect(couponDiscount({ kind: "fixed", value: 99999 }, 5000)).toBe(5000);
    expect(couponDiscount({ kind: "percent", value: 120 }, 4000)).toBe(4000);
  });

  it("returns 0 without coupon or non-positive subtotal", () => {
    expect(couponDiscount(null, 1000)).toBe(0);
    expect(couponDiscount(undefined, 1000)).toBe(0);
    expect(couponDiscount({ kind: "fixed", value: 500 }, -10)).toBe(0);
  });

  it("rounds percent to integer minor units", () => {
    expect(couponDiscount({ kind: "percent", value: 15 }, 100)).toBe(15);
    expect(couponDiscount({ kind: "percent", value: 10 }, 333)).toBe(33);
  });
});

describe("computeTotals", () => {
  it("no coupon, tax excluded (add-on)", () => {
    const t = computeTotals({ subtotal: 100000, taxRate: 15, taxIncludedInPrices: false });
    expect(t.discount).toBe(0);
    expect(t.taxAmount).toBe(15000);
    expect(t.total).toBe(115000);
  });

  it("no coupon, tax included (extracts IVA)", () => {
    const t = computeTotals({ subtotal: 115000, taxRate: 15, taxIncludedInPrices: true });
    expect(t.taxAmount).toBe(15000);
    expect(t.total).toBe(115000);
  });

  it("percent coupon reduces the IVA extraction base", () => {
    const t = computeTotals({
      subtotal: 115000,
      coupon: { kind: "percent", value: 10 },
      taxRate: 15,
      taxIncludedInPrices: true,
    });
    const base = 115000 - 11500;
    expect(t.discount).toBe(11500);
    expect(t.taxableBase).toBe(base);
    expect(t.taxAmount).toBe(Math.round((base * 15) / 115));
    expect(t.total).toBe(base);
  });

  it("uses credit clamped to balance and total", () => {
    const t = computeTotals({ subtotal: 10000, creditToApply: 50000, creditBalance: 3000, taxRate: 0 });
    expect(t.creditUsed).toBe(3000);
    expect(t.total).toBe(7000);
  });

  it("no credit when not requested", () => {
    const t = computeTotals({ subtotal: 10000, creditBalance: 9000 });
    expect(t.creditUsed).toBe(0);
    expect(t.total).toBe(10000);
  });

  it("sanitizes non-finite inputs", () => {
    const t = computeTotals({ subtotal: Number.NaN, taxRate: 15 });
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
  });
});