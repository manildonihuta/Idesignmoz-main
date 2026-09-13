"use client";

import Link from "next/link";
import type { ClientEmailService } from "@/lib/client-data";

const STATUS: Record<string, { label: string; tone: string }> = {
  provisioning: { label: "A aprovisionar", tone: "text-amber-600" },
  active: { label: "Ativo", tone: "text-emerald-600" },
  suspended: { label: "Suspenso", tone: "text-red-600" },
  error: { label: "Erro", tone: "text-red-600" },
  cancelled: { label: "Cancelado", tone: "text-muted" },
};

function fmt(date: string | null): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return date;
  }
}

export function EmailsView({ services }: { services: ClientEmailService[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display-2 text-2xl font-semibold tracking-tight">Email</h1>
          <p className="text-muted">Caixas de email profissionais nos seus domínios.</p>
        </div>
        <div className="flex gap-3">
          <Link className="button" href="/hosting/email-50">Ver planos de email ↗</Link>
          <Link className="outline-button" href="/contact">Pedir suporte ↗</Link>
        </div>
      </div>

      {!services.length ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
          Ainda não tem caixas de email profissionais ativas. Associe o seu plano de
          email profissional para começar a usar caixas no seu domínio.
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((s) => {
            const st = STATUS[s.status] ?? { label: s.status, tone: "" };
            return (
              <Link
                key={s.id}
                href={`/dashboard/email/${s.id}`}
                className="block rounded-xl border border-line bg-surface p-5 transition hover:border-emerald-300 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold">{s.domain}</div>
                    <div className="text-sm text-muted mt-1">{s.planName}{s.providerLabel ? ` · ${s.providerLabel}` : ""}</div>
                  </div>
                  <span className={`text-sm font-medium ${st.tone}`}>{st.label}</span>
                </div>
                <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                  <div><span className="text-muted">Caixas:</span> {s.mailboxLimit}</div>
                  <div><span className="text-muted">Armazenamento:</span> {s.storageLimitGb} GB</div>
                  <div><span className="text-muted">Renova:</span> {fmt(s.expiresAt)}</div>
                </div>
                <div className="mt-3 text-xs text-muted">Criado {fmt(s.createdAt)} · DNS: {s.dnsStatus}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}