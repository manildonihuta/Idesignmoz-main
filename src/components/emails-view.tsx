"use client";

import Link from "next/link";

export function EmailsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Email
        </h1>
        <p className="text-muted">Caixas de email profissionais nos seus domínios.</p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
        Ainda não tem caixas de email profissionais ativas. Associe o seu plano de
        email profissional para começar a usar caixas no seu domínio.
      </div>

      <div className="email-plan-actions">
        <Link className="button" href="/hosting/email-50">
          Ver planos de email ↗
        </Link>
        <Link className="outline-button" href="/contact">
          Pedir suporte ↗
        </Link>
      </div>
    </div>
  );
}
