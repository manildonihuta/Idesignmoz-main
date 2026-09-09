"use client";

import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { Modal, Button } from "@/components/ui/core";
import type { PropagationCheck } from "@/lib/dns/types";

export type PropagationState = {
  state: "idle" | "checking" | "done";
  checks: PropagationCheck[];
};

export default function PropagationModal({
  fullDomain,
  state,
  onClose,
  onRetry,
}: {
  fullDomain: string;
  state: PropagationState;
  onClose: () => void;
  onRetry: () => void;
}) {
  const matched = state.checks.filter((c) => c.matched).length;

  return (
    <Modal
      open={state.state !== "idle"}
      onClose={state.state === "checking" ? () => {} : onClose}
      title="Verificação de propagação"
      description={`Estado público do DNS de ${fullDomain} (DNS-over-HTTPS).`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={state.state === "checking"}>
            Fechar
          </Button>
          <Button variant="brand" size="sm" type="button" onClick={onRetry} loading={state.state === "checking"}>
            {state.state === "checking" ? "A verificar…" : "Verificar novamente"}
          </Button>
        </>
      }
    >
      {state.state === "checking" ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <Loader2 className="size-5 animate-spin" />
          A consultar os servidores DNS públicos…
        </div>
      ) : state.checks.length === 0 ? (
        <div className="py-8 text-sm text-muted">
          Não há registos na zona para verificar. Crie registos para poder confirmar a propagação.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-semibold text-ok">{matched} de {state.checks.length}</span>{" "}
            registos encontrados nos DNS públicos.
          </p>
          <div className="space-y-2">
            {state.checks.map((check) => (
              <div key={`${check.query}|${check.type}`} className="rounded-lg border border-line bg-ink p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <code className="text-xs">{check.query}</code>
                    <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{check.type}</span>
                  </div>
                  {check.matched ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok">
                      <CheckCircle2 className="size-4" /> Encontrado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                      <XCircle className="size-4" /> Não detetado
                    </span>
                  )}
                </div>
                {check.answers.length > 0 ? (
                  <p className="mt-2 break-all text-xs text-muted">{check.answers.join(" · ")}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted">Sem respostas nos servidores públicos — a propagação pode ainda estar a decorrer.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}