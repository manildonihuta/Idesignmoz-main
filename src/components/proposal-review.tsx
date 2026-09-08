"use client";
import Image from "next/image";
import { useCallback, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSignature,
  Loader2,
  MessageSquareWarning,
  Pencil,
  XCircle,
} from "lucide-react";
import { fmtMT } from "@/lib/invoices";
import type { CompanyInfo } from "@/lib/site-settings";
import {
  PROPOSAL_STATUS_LABEL,
  downloadProposalPdf,
  type Proposal,
  type ProposalStatus,
} from "@/lib/proposals";

type Props = { proposal: Proposal; company: CompanyInfo };

type Notice = { type: "ok" | "error"; text: string } | null;

const TONE: Record<ProposalStatus, string> = {
  draft: "text-muted border-line bg-surface",
  sent: "text-brand border-brand/40 bg-brand/10",
  approved: "text-ok border-ok/40 bg-surface",
  rejected: "text-brand border-brand/40 bg-brand/10",
  changes_requested: "text-brand border-brand/40 bg-brand/10",
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function validUntil(p: Proposal): string {
  const d = new Date(p.createdAt);
  d.setDate(d.getDate() + (p.validityDays || 30));
  return fmtDate(d.toISOString());
}

export function ProposalReview({ proposal: initial, company }: Props) {
  const [proposal, setProposal] = useState(initial);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const decided = proposal.status === "approved" || proposal.status === "rejected";
  const ready = proposal.status === "sent" || proposal.status === "changes_requested";

  const act = useCallback(
    async (action: "approve" | "reject" | "changes") => {
      if (busy) return;
      if (action === "reject" && !comment.trim()) {
        setNotice({ type: "error", text: "Indica o motivo da rejeição." });
        return;
      }
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch(`/api/proposals/${proposal.token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, comment: comment.trim() }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Não foi possível atualizar a proposta.");
        setProposal(json.proposal);
        setComment("");
        const done = json.proposal.status as ProposalStatus;
        setNotice({
          type: "ok",
          text:
            done === "approved"
              ? "Proposta aprovada. Obrigado!"
              : done === "rejected"
                ? "Proposta rejeitada. Lamentamos."
                : "Pedido de alterações registado.",
        });
      } catch (err) {
        setNotice({ type: "error", text: err instanceof Error ? err.message : "Não foi possível atualizar." });
      } finally {
        setBusy(false);
      }
    },
    [busy, proposal.token, comment],
  );

  return (
    <div className="min-h-screen bg-ink px-4 py-10 text-paper">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-content-center overflow-hidden rounded-lg bg-surface-2">
              <Image src="/icon.png" alt="IDesign Moz" width={1224} height={1285} />
            </div>
            <div>
              <p className="text-sm font-semibold">
                IDesign <span className="text-brand">Moz</span>
              </p>
              <p className="text-xs text-muted">Proposta Comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${TONE[proposal.status]}`}>
              {proposal.status === "approved" && <CheckCircle2 className="size-3.5" />}
              {proposal.status === "rejected" && <XCircle className="size-3.5" />}
              {proposal.status === "changes_requested" && <MessageSquareWarning className="size-3.5" />}
              {PROPOSAL_STATUS_LABEL[proposal.status]}
            </span>
            <button
              type="button"
              onClick={() => downloadProposalPdf(proposal, company)}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-paper transition-colors hover:bg-surface-2"
            >
              <Download className="size-4" />
              Descarregar PDF
            </button>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-surface-2 px-6 py-7 sm:px-8">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">{proposal.code}</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{proposal.title}</h1>
              <p className="mt-1.5 text-sm text-muted">
                Emitida em {fmtDate(proposal.createdAt)} · válida até {validUntil(proposal)}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-xs uppercase tracking-wider text-muted">Cliente</p>
              <p className="mt-1 font-semibold">{proposal.clientName}</p>
              {proposal.clientCompany && <p className="text-muted">{proposal.clientCompany}</p>}
              {proposal.clientEmail && <p className="text-muted">{proposal.clientEmail}</p>}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-6 py-3 sm:px-8">Serviço</th>
                <th className="px-3 py-3 text-center">Qtd</th>
                <th className="px-3 py-3 text-right">Preço unit.</th>
                <th className="px-6 py-3 text-right sm:px-8">Total</th>
              </tr>
            </thead>
            <tbody>
              {proposal.lines.map((l) => (
                <tr key={l.key} className="border-b border-line last:border-0">
                  <td className="px-6 py-4 align-top sm:px-8">
                    <p className="font-semibold">{l.label}</p>
                    <p className="mt-0.5 text-xs text-muted">{l.detail}</p>
                  </td>
                  <td className="px-3 py-4 text-center text-muted">{l.qty}</td>
                  <td className="px-3 py-4 text-right text-muted">{fmtMT(l.unitPrice)} MT</td>
                  <td className="px-6 py-4 text-right font-semibold sm:px-8">{fmtMT(l.unitPrice * l.qty)} MT</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-full max-w-sm px-6 py-5 text-sm sm:px-8">
            <div className="flex justify-between py-1 text-muted">
              <span>Subtotal</span>
              <span>{fmtMT(proposal.subtotal)} MT</span>
            </div>
            {proposal.discountPercent > 0 && (
              <div className="flex justify-between py-1 text-muted">
                <span>Desconto ({proposal.discountPercent}%)</span>
                <span>-{fmtMT(proposal.discountAmount)} MT</span>
              </div>
            )}
            {proposal.taxRate > 0 && (
              <div className="flex justify-between py-1 text-muted">
                <span>Imposto ({proposal.taxRate}%)</span>
                <span>+{fmtMT(proposal.taxAmount)} MT</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line py-2 text-base font-bold">
              <span>Total</span>
              <span>{fmtMT(proposal.total)} MT</span>
            </div>
          </div>

          {proposal.notes && (
            <div className="border-t border-line px-6 py-5 text-sm sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Notas</p>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-paper/80">{proposal.notes}</p>
            </div>
          )}

          {proposal.clientComment && (
            <div className="border-t border-line px-6 py-5 text-sm sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Resposta do cliente</p>
              <p className="mt-2 leading-relaxed text-paper/80">{proposal.clientComment}</p>
            </div>
          )}
        </section>

        {notice && (
          <div
            role="status"
            className={`mt-5 rounded-lg border px-4 py-3 text-sm ${
              notice.type === "ok" ? "border-ok bg-surface text-ok" : "border-brand bg-surface text-brand"
            }`}
          >
            {notice.text}
          </div>
        )}

        {ready && (
          <section className="mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-content-center rounded-lg bg-surface-2 text-brand">
                <FileSignature className="size-4" />
              </div>
              <div>
                <h2 className="font-bold">Decide agora</h2>
                <p className="text-sm text-muted">
                  {proposal.status === "changes_requested"
                    ? "Revisão enviada antes: podes aprovar, ajustar o pedido ou rejeitar."
                    : "Revisa a proposta acima e decide como pretendes avançar."}
                </p>
              </div>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Comentário para a equipa (obrigatório se rejeitares)…"
              className="mt-5 w-full resize-none rounded-lg border border-line bg-ink px-4 py-3 text-sm text-paper outline-none transition-colors placeholder:text-muted focus:border-brand"
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => act("approve")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-ok px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:brightness-110 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Aprovar proposta
              </button>
              <button
                type="button"
                onClick={() => act("changes")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink disabled:opacity-60"
              >
                <Pencil className="size-4" />
                Pedir alterações
              </button>
              <button
                type="button"
                onClick={() => act("reject")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-surface px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
              >
                <XCircle className="size-4" />
                Rejeitar
              </button>
            </div>
          </section>
        )}

        {decided && (
          <p className="mt-6 text-center text-sm text-muted">
            Esta proposta já foi decidida. Obrigado pela tua resposta.
          </p>
        )}

        {proposal.status === "draft" && (
          <p className="mt-6 text-center text-sm text-muted">Esta proposta ainda está em preparação.</p>
        )}

        <footer className="mt-10 border-t border-line pt-5 text-center text-xs text-muted">
          {company.name} · {company.address}{company.nuit ? ` · NUIT ${company.nuit}` : ""}
        </footer>
      </div>
    </div>
  );
}