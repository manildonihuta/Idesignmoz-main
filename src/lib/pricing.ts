/**
 * Pure money math for checkout/invoicing. All amounts are integer minor units
 * (e.g. MZN). No I/O — unit-testable.
 */

export type CouponMath = {
  kind: "percent" | "fixed";
  value: number;              // percent points (e.g. 10) or fixed amount (minor units)
  maxDiscount?: number | null;
  minSubtotal?: number | null;
};

export type TotalsInput = {
  subtotal: number;
  coupon?: CouponMath | null;
  taxRate?: number;             // percent, e.g. 15
  taxIncludedInPrices?: boolean; // prices already contain IVA
  creditToApply?: number;       // desired credit usage (minor units)
  creditBalance?: number;       // customer's available credit (minor units)
};

export type Totals = {
  subtotal: number;
  discount: number;
  taxableBase: number;   // subtotal − discount (what IVA is computed on)
  taxRate: number;
  taxAmount: number;
  totalBeforeCredit: number;
  creditUsed: number;
  total: number;         // amount the customer actually pays
};

export function couponDiscount(coupon: CouponMath | null | undefined, subtotal: number): number {
  if (!coupon || subtotal <= 0) return 0;
  const raw =
    coupon.kind === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : coupon.value;
  let discount = Math.max(0, Math.min(raw, subtotal));
  if (coupon.maxDiscount != null && coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return discount;
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = Number.isFinite(input.subtotal) ? Math.max(0, Math.round(input.subtotal)) : 0;
  const taxRate = Number.isFinite(input.taxRate) ? Math.max(0, input.taxRate ?? 0) : 0;

  const discount = couponDiscount(input.coupon, subtotal);
  const taxableBase = subtotal - discount;

  const taxIncluded = input.taxIncludedInPrices !== false;
  let taxAmount = 0;
  let totalBeforeCredit = taxableBase;
  if (taxRate > 0) {
    if (taxIncluded) {
      // IVA is inside the prices: extract it from the (discounted) base.
      taxAmount = Math.round((taxableBase * taxRate) / (100 + taxRate));
      totalBeforeCredit = taxableBase;
    } else {
      taxAmount = Math.round((taxableBase * taxRate) / 100);
      totalBeforeCredit = taxableBase + taxAmount;
    }
  }

  let creditUsed = 0;
  const desired = Number.isFinite(input.creditToApply) ? Math.max(0, Math.round(input.creditToApply ?? 0)) : 0;
  const available = Number.isFinite(input.creditBalance) ? Math.max(0, Math.round(input.creditBalance ?? 0)) : 0;
  if (desired > 0 && totalBeforeCredit > 0) {
    creditUsed = Math.min(desired, available, totalBeforeCredit);
  }

  return {
    subtotal,
    discount,
    taxableBase,
    taxRate,
    taxAmount,
    totalBeforeCredit,
    creditUsed,
    total: totalBeforeCredit - creditUsed,
  };
}