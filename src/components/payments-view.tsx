"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ClientPayment } from "@/lib/client-data";

type PaymentMethod = {
  id: string;
  name: string;
  description: string;
  kind: string;
  enabled: boolean;
};

const PROOF_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf";

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

function ProofUpload({ tx, onDone }: { tx: ClientPayment; onDone: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/payments/${tx.id}/proof`, { method: "POST", body });
      const json = (await res.json()) as { ok?: boolean; error?: string; status?: number };
      if (!json.ok) {
        onDone(json.error ?? "Não foi possível enviar o comprovativo.");
        return;
      }
      onDone("Comprovativo enviado. A nossa equipa vai confirmar o pagamento em breve.");
    } catch {
      onDone("Erro de rede ao enviar o comprovativo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="payment-tx" style={{ marginTop: 10 }}>
      <div className="payment-tx-main">
        <strong>Confirmar o pagamento</strong>
        <p className="payment-tx-meta">
          Envia o comprovativo (captura de ecrã ou PDF) para confirmarmos o pagamento de {fmtMT(tx.amount)} MT.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={PROOF_ACCEPT}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          className="mt-2 block text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-paper"
        />
      </div>
    </div>
  );
}

function TransactionRow({ tx, onProofDone }: { tx: ClientPayment; onProofDone: (message: string) => void }) {
  return (
    <>
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
      {tx.canUploadProof ? <ProofUpload tx={tx} onDone={onProofDone} /> : null}
    </>
  );
}

export function PaymentsView({ payments }: { payments: ClientPayment[] }) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 7000);
  }

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

      {notice ? (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm text-paper" role="status">
          {notice}
        </div>
      ) : null}

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
            <TransactionRow key={tx.id} tx={tx} onProofDone={showNotice} />
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