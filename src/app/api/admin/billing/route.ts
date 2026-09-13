import { NextRequest } from "next/server";

import { requirePermissionRoute } from "@/lib/admin";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import {
  addCredit,
  adminBillingData,
  approveRefund,
  rejectPendingPayment,
  rejectRefund,
  requestRefund,
  settlePendingPayment,
  type BillingActor,
} from "@/services/money.service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = { prefix: "admin-billing", limit: 120, windowSec: 60 };

function actor(guard: { ctx: { userId?: string; email?: string; role: string } }, ip: string): BillingActor {
  return { userId: guard.ctx.userId, email: guard.ctx.email, role: guard.ctx.role, ip };
}

export async function GET(request: NextRequest) {
  const guard = await requirePermissionRoute("billing.manage");
  if (guard.response) return guard.response;

  const limited = await applyRateLimit(request, { ...LIMIT, ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const result = await adminBillingData();
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: NextRequest) {
  const guard = await requirePermissionRoute("billing.manage");
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { ...LIMIT, prefix: "admin-billing-action", ip: clientIp(request) });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const ip = clientIp(request);
  const who = actor(guard, ip);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const str = (name: string): string => (typeof body[name] === "string" ? (body[name] as string).trim() : "");
  const num = (name: string): number => {
    const raw = str(name);
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };
  const action = str("action");

  try {
    switch (action) {
      case "payment_settle": {
        const paymentId = str("paymentId");
        if (!UUID_RE.test(paymentId)) return Response.json({ ok: false, error: "Pagamento inválido." }, { status: 400 });
        const result = await settlePendingPayment(paymentId, who);
        return Response.json({ ...result, message: "Pagamento confirmado." }, { status: result.ok ? 200 : result.status });
      }
      case "payment_reject": {
        const paymentId = str("paymentId");
        const reason = str("reason");
        if (!UUID_RE.test(paymentId)) return Response.json({ ok: false, error: "Pagamento inválido." }, { status: 400 });
        if (!reason) return Response.json({ ok: false, error: "Indica o motivo da rejeição." }, { status: 400 });
        const result = await rejectPendingPayment(paymentId, reason, who);
        return Response.json({ ...result, message: "Pagamento rejeitado." }, { status: result.ok ? 200 : result.status });
      }
      case "refund_request": {
        const paymentId = str("paymentId");
        const amount = num("amount");
        const reason = str("reason");
        if (!UUID_RE.test(paymentId)) return Response.json({ ok: false, error: "Pagamento inválido." }, { status: 400 });
        if (!reason) return Response.json({ ok: false, error: "Indica o motivo do reembolso." }, { status: 400 });
        const result = await requestRefund({ paymentId, amount, reason, notes: str("notes") || undefined, actor: who });
        return Response.json(result, { status: result.ok ? 200 : result.status });
      }
      case "refund_approve": {
        const refundId = str("refundId");
        if (!UUID_RE.test(refundId)) return Response.json({ ok: false, error: "Reembolso inválido." }, { status: 400 });
        const result = await approveRefund({
          refundId,
          notes: str("notes") || undefined,
          providerRef: str("providerRef") || undefined,
          actor: who,
        });
        return Response.json({ ...result, message: "Reembolso processado." }, { status: result.ok ? 200 : result.status });
      }
      case "refund_reject": {
        const refundId = str("refundId");
        if (!UUID_RE.test(refundId)) return Response.json({ ok: false, error: "Reembolso inválido." }, { status: 400 });
        const result = await rejectRefund({ refundId, notes: str("notes") || undefined, actor: who });
        return Response.json({ ...result, message: "Reembolso recusado." }, { status: result.ok ? 200 : result.status });
      }
      case "credit_add": {
        const customerId = str("customerId");
        const amount = num("amount");
        const reason = str("reason");
        if (!UUID_RE.test(customerId)) return Response.json({ ok: false, error: "Cliente inválido." }, { status: 400 });
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          return Response.json({ ok: false, error: "Valor de crédito inválido." }, { status: 400 });
        }
        if (!reason) return Response.json({ ok: false, error: "Indica o motivo do crédito." }, { status: 400 });
        const result = await addCredit({ customerId, amount, reason, actor: who });
        return Response.json({ ...result, message: "Crédito adicionado." }, { status: result.ok ? 200 : result.status });
      }
      default:
        return Response.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    serverLogError("api:admin/billing", error);
    return Response.json({ ok: false, error: "Erro interno ao processar a facturação." }, { status: 500 });
  }
}