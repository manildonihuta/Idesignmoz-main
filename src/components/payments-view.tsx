"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ClientPayment } from "@/lib/client-data";

type PaymentMethod = {
  id: string;
  name: string;
  description: string;
  kind: string;
  enabled: boolean;
};

function fmtMT(value: number): string {
  return new Intl.NumberFormat("pt-MZ", { maximumFractionDigits: 0 }).format(value);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-MZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function TransactionRow({ tx }: { tx: ClientPayment }) {
  return (
    <div className="payment-tx">
      <div className="payment-tx-icon">{(tx.method ?? "?").charAt(0)}</div>
      <div className="payment-tx-main">
        <strong>{tx.description ?? "Pagamento"}</strong>
        <p className="payment-tx-meta">
          {fmtDate(tx.createdAt)} · {tx.reference ? `Ref. ${tx.reference} · ` : ""}{tx.method ?? "—"}
        </p>
      </div>
      <div className="payment-tx-right">
        <span className={`tx-status ${tx.status.toLowerCase()}`}>{tx.status}</span>
        <b>{fmtMT(tx.amount)} MT</b>
      </div>
    </div>
  );
}

export function PaymentsView({ payments }: { payments: ClientPayment[] }) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/methods")
      .then((res) => res.json())
      .then((data: { ok?: boolean; methods?: PaymentMethod[] }) => {
        if (!cancelled && Array.isArray(data.methods)) {
          setMethods(data.methods.filter((m) => m.enabled));
        }
      })
      .catch(() => {
        /* ignore — methods are informational */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Pagamentos
        </h1>
        <p className="text-muted">Histórico de transacções e métodos de pagamento.</p>
      </div>

      {methods.length > 0 ? (
        <div className="payment-block">
          <div className="payment-block-head">
            <div>
              <span className="order-label">Métodos de pagamento</span>
              <h3>Cartões e carteiras</h3>
            </div>
          </div>

          <div className="payment-methods">
            {methods.map((method) => (
              <div className="payment-method" key={method.id}>
                <div className="payment-method-main">
                  <span className="payment-method-icon">{method.name.charAt(0)}</span>
                  <div>
                    <strong>{method.name}</strong>
                    <p className="payment-tx-meta">{method.description}</p>
                  </div>
                </div>
                {method.enabled ? (
                  <span className="tx-status paid">Ativo</span>
                ) : (
                  <span className="tx-status pending">Inativo</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="payment-block">
        <div className="payment-block-head">
          <div>
            <span className="order-label">Histórico</span>
            <h3>Transacções recentes</h3>
          </div>
        </div>
        <div className="payment-tx-list">
          {payments.length === 0 && (
            <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
              Ainda não tem transacções.
            </div>
          )}
          {payments.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      </div>

      <div className="email-plan-actions">
        <Link className="button" href="/dashboard/invoices">
          Ver facturas ↗
        </Link>
        <Link className="outline-button" href="/contact">
          Apoio de facturação ↗
        </Link>
      </div>
    </div>
  );
}