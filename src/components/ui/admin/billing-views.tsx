"use client";

import { useCallback, useEffect, useState } from "react";

import type { Notify } from "./types";
import { ActionBtn, Empty, Pill, SectionHead, Spinner, card, fmtDate, fmtMT } from "./views";

type ProofRow = {
  id: string;
  file_url: string;
  mime: string;
  status: string;
  created_at: string;
};

type PaymentRow = {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  method: string;
  reference: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  payment_proofs?: ProofRow[] | null;
};

type RefundRow = {
  id: string;
  payment_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  created_at: string;
};

type CreditRow = {
  id: string;
  customer_id: string | null;
  amount: number;
  reason: string;
  balance_after: number;
  created_at: string;
};

type BillingData = {
  pendingPayments: PaymentRow[];
  recentPayments: PaymentRow[];
  refunds: RefundRow[];
  credits: CreditRow[];
  summary: { pending: number; pendingValue: number; refundsRequested: number; creditsIssued: number };
};

const METHOD_LABEL: Record<string, string> = {
  mpesa: "M-Pesa",
  emola: "e-Mola",
  mkesh: "mKesh",
  visa: "Visa",
  mastercard: "Mastercard",
  card: "Cartão",
  bank_transfer: "Transferência",
  "bank-transfer": "Transferência",
  cash: "Numerário",
};

function methodLabel(m: string): string {
  return METHOD_LABEL[m] ?? m ?? "—";
}

export function CobrancasAdminView({ notify }: { notify: Notify }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [busy, setBusy] = useState("");
  const [creditForm, setCreditForm] = useState({ customerId: "", amount: "", reason: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/billing", { cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean } & BillingData;
      if (json.ok !== false) setData(json);
    } catch {
      /* keep last data */
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function post(action: string, payload: Record<string, unknown>, okText: string) {
    setBusy(action);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!json.ok) throw new Error(json.error ?? "Ação falhou.");
      notify("ok", json.message ?? okText);
      await load();
      return true;
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Ação falhou.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function addCredit() {
    const customerId = creditForm.customerId.trim();
    const amount = Number(creditForm.amount);
    const reason = creditForm.reason.trim();
    if (!customerId || !Number.isSafeInteger(amount) || amount <= 0 || !reason) {
      notify("error", "Preenche cliente, valor inteiro e motivo.");
      return;
    }
    if (await post("credit_add", { customerId, amount, reason }, "Crédito adicionado.")) {
      setCreditForm({ customerId: "", amount: "", reason: "" });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-4">
        <div className={card}>
          <p className="text-xs text-muted">Pagamentos pendentes</p>
          <p className="mt-1 text-2xl font-semibold">{data?.summary.pending ?? 0}</p>
          <p className="mt-1 text-xs text-muted">{fmtMT(data?.summary.pendingValue ?? 0)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted">Reembolsos pedidos</p>
          <p className="mt-1 text-2xl font-semibold">{data?.summary.refundsRequested ?? 0}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted">Créditos emitidos</p>
          <p className="mt-1 text-2xl font-semibold">{fmtMT(data?.summary.creditsIssued ?? 0)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted">Referência</p>
          <p className="mt-1 text-xs text-muted">M-Pesa, e-Mola, mKesh e transferências exigem verificação manual.</p>
        </div>
      </div>

      {/* Pending payments */}
      <section>
        <SectionHead
          title="Pagamentos a confirmar"
          desc="Comprovativos aguardam verificação manual (M-Pesa, e-Mola, mKesh, transferência)."
          right={busy === "loading" ? <Spinner /> : undefined}
        />
        {!data ? (
          <div className={card}><Spinner /></div>
        ) : data.pendingPayments.length === 0 ? (
          <div className={card}><Empty text="Sem pagamentos pendentes." /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.pendingPayments.map((p) => (
              <div key={p.id} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {p.customer_name ?? "Cliente"} · {fmtMT(p.amount)} {p.currency}
                    </p>
                    <p className="text-xs text-muted">
                      {methodLabel(p.method)} {p.reference ? `· Ref. ${p.reference}` : ""} · {fmtDate(p.created_at)}
                    </p>
                    {(p.payment_proofs ?? []).map((proof) => (
                      <a
                        key={proof.id}
                        href={proof.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-brand underline"
                      >
                        Ver comprovativo ↗
                      </a>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <ActionBtn
                      tone="ok"
                      busy={busy === "settle"}
                      disabled={busy === "settle" || busy === "reject"}
                      onClick={() => post("payment_settle", { paymentId: p.id }, "Pagamento confirmado.")}
                    >
                      Confirmar
                    </ActionBtn>
                    <ActionBtn
                      tone="danger"
                      busy={busy === "reject"}
                      disabled={busy === "settle" || busy === "reject"}
                      onClick={() => {
                        const reason = window.prompt("Motivo da rejeição:");
                        if (reason && reason.trim()) {
                          void post("payment_reject", { paymentId: p.id, reason: reason.trim() }, "Pagamento rejeitado.");
                        }
                      }}
                    >
                      Rejeitar
                    </ActionBtn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Refunds */}
        <section>
          <SectionHead title="Reembolsos" desc="Confirma o reembolso para creditar o cliente." />
          {!data ? (
            <div className={card}><Spinner /></div>
          ) : data.refunds.length === 0 ? (
            <div className={card}><Empty text="Sem reembolsos." /></div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.refunds.slice(0, 10).map((r) => (
                <div key={r.id} className={card}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{fmtMT(r.amount)} {r.currency}</p>
                      <p className="text-xs text-muted">{r.customer_name ?? "Cliente"} · {r.reason}</p>
                      <p className="text-xs text-muted">{fmtDate(r.created_at)}</p>
                    </div>
                    <Pill tone={r.status === "requested" ? "warn" : r.status === "processed" ? "ok" : r.status === "rejected" ? "danger" : "muted"}>
                      {r.status}
                    </Pill>
                  </div>
                  {r.status === "requested" ? (
                    <div className="mt-3 flex gap-2">
                      <ActionBtn tone="ok" busy={busy === "approve-refund"} onClick={() => post("refund_approve", { refundId: r.id }, "Reembolso processado.")}>
                        Processar
                      </ActionBtn>
                      <ActionBtn tone="danger" busy={busy === "reject-refund"} onClick={() => post("refund_reject", { refundId: r.id }, "Reembolso recusado.")}>
                        Recusar
                      </ActionBtn>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Credits */}
        <section>
          <SectionHead title="Créditos" desc="Registo de créditos e saldo dos clientes." />
          <div className={`${card} mb-3`}>
            <p className="mb-3 text-sm font-semibold">Adicionar crédito</p>
            <div className="flex flex-col gap-2">
            <input
              value={creditForm.customerId}
              onChange={(e) => setCreditForm((f) => ({ ...f, customerId: e.target.value }))}
              placeholder="ID do cliente (uuid)"
              className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
            />
            <input
              value={creditForm.amount}
              onChange={(e) => setCreditForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="Valor (MT)"
              className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
            />
            <input
              value={creditForm.reason}
              onChange={(e) => setCreditForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Motivo"
              className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
            />
            <ActionBtn tone="brand" busy={busy === "credit_add"} onClick={() => void addCredit()}>
              Adicionar
            </ActionBtn>
            </div>
          </div>
          {!data ? (
            <div className={card}><Spinner /></div>
          ) : data.credits.length === 0 ? (
            <div className={card}><Empty text="Sem movimentos de crédito." /></div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.credits.slice(0, 10).map((c) => (
                <div key={c.id} className={card}>
                  <p className="text-sm font-semibold">{fmtMT(c.amount)}</p>
                  <p className="text-xs text-muted">{c.reason}</p>
                  <p className="text-xs text-muted">{fmtDate(c.created_at)} · saldo {fmtMT(c.balance_after)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}