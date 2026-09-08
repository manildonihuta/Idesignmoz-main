"use client";

import Link from "next/link";
import { useState } from "react";

import {
  fmtMT,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/payments";
import type { ClientPayment } from "@/lib/client-data";

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
  const [methods, setMethods] = useState<PaymentMethod[]>(PAYMENT_METHODS);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDetail, setNewDetail] = useState("");

  const setPrimary = (id: string) => {
    setMethods((current) => current.map((m) => ({ ...m, primary: m.id === id })));
  };

  const addMethod = () => {
    if (!newLabel.trim()) return;
    setMethods((current) => [
      ...current,
      {
        id: `custom-${current.length + 1}`,
        label: newLabel.trim(),
        detail: newDetail.trim() || "—",
        status: "Active",
        primary: false,
      },
    ]);
    setNewLabel("");
    setNewDetail("");
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Pagamentos
        </h1>
        <p className="text-muted">Histórico de transacções e métodos de pagamento.</p>
      </div>

      <div className="payment-block">
        <div className="payment-block-head">
          <div>
            <span className="order-label">Métodos de pagamento</span>
            <h3>Cartões e carteiras</h3>
          </div>
          <button
            className="outline-button"
            type="button"
            onClick={() => setShowAdd((v) => !v)}
          >
            + Adicionar
          </button>
        </div>

        {showAdd ? (
          <div className="ticket-form" style={{ marginBottom: 16 }}>
            <div className="ticket-form-grid">
              <input
                className="profile-input"
                placeholder="Nome do método (ex.: mKesh)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <input
                className="profile-input"
                placeholder="Detalhe (número, cartão…)"
                value={newDetail}
                onChange={(e) => setNewDetail(e.target.value)}
              />
            </div>
            <div className="ticket-actions">
              <button className="button" type="button" onClick={addMethod}>
                Guardar método
              </button>
            </div>
          </div>
        ) : null}

        <div className="payment-methods">
          {methods.map((method) => (
            <div className="payment-method" key={method.id}>
              <div className="payment-method-main">
                <span className="payment-method-icon">{method.label.charAt(0)}</span>
                <div>
                  <strong>{method.label}</strong>
                  <p className="payment-tx-meta">{method.detail}</p>
                </div>
              </div>
              {method.primary ? (
                <span className="tx-status paid">Primary</span>
              ) : (
                <button
                  className="outline-button"
                  type="button"
                  onClick={() => setPrimary(method.id)}
                >
                  Tornar principal
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

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
