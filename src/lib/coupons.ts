import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { couponDiscount } from "@/lib/pricing";

export type CouponRow = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
};

export type CouponCheck =
  | { ok: true; coupon: CouponRow; discount: number }
  | { ok: false; error: string; status: number };

export function usable(coupon: CouponRow, subtotal: number): string | null {
  const now = Date.now();
  if (!coupon.active) return "Este cupão já não está ativo.";
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) {
    return "Este cupão ainda não está ativo.";
  }
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < now) {
    return "Este cupão expirou.";
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return "Este cupão atingiu o limite de utilizações.";
  }
  if (coupon.min_subtotal > 0 && subtotal < coupon.min_subtotal) {
    return `Este cupão exige um mínimo de ${coupon.min_subtotal} MT.`;
  }
  return null;
}

/** Resolves + validates a coupon code against the current subtotal. */
export async function resolveCoupon(
  code: string,
  subtotal: number,
): Promise<CouponCheck> {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!normalized) {
    return { ok: false, error: "Indica o código do cupão.", status: 400 };
  }

  const { data, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Cupão não encontrado.", status: 404 };
  }

  const coupon = data as unknown as CouponRow;
  const reason = usable(coupon, subtotal);
  if (reason) {
    return { ok: false, error: reason, status: 400 };
  }

  return {
    ok: true,
    coupon,
    discount: couponDiscount(
      { kind: coupon.kind, value: Number(coupon.value), maxDiscount: coupon.max_discount },
      subtotal,
    ),
  };
}