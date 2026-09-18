"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { WebsitePackage } from "@/lib/website-packages";
import { formatMZN } from "@/lib/currency";
import { SelectDropdown } from "@/components/ui/dropdown-menu";

type FormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  timeline: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  message: "",
  timeline: "2-4 weeks",
};

const TIMELINES: { value: string; label: string }[] = [
  { value: "2-4 weeks", label: "2–4 semanas" },
  { value: "1-2 months", label: "1–2 meses" },
  { value: "3+ months", label: "3+ meses (projeto maior)" },
];

export function WebsiteBriefForm({ pkg }: { pkg: WebsitePackage }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    if (!form.name.trim() || !emailOk || !form.message.trim()) {
      setError("Preencha o nome, um email válido e a descrição do projeto.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/website-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageSlug: pkg.slug, ...form }),
      });
      const data = await res.json();
      if (res.ok && data?.proposalToken) {
        router.push(`/proposta/${data.proposalToken}`);
        return;
      }
      setError(data?.error ?? "Não foi possível enviar o briefing. Tente novamente.");
    } catch {
      setError("Não foi possível enviar o briefing. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="checkout-panel" onSubmit={onSubmit}>
      <h2 className="mb-1">Briefing · {pkg.name}</h2>
      <p className="checkout-hint mb-4">
        Orçamento de referência: <b>{formatMZN(pkg.price)} MT</b> (sem IVA na proposta).
      </p>

      <div className="checkout-formgrid">
        <label className="checkout-field">
          Nome completo *
          <input
            type="text"
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="O seu nome"
            autoComplete="name"
          />
        </label>
        <label className="checkout-field">
          Empresa
          <input
            type="text"
            value={form.company}
            onChange={(event) => set("company", event.target.value)}
            placeholder="O nome da empresa (opcional)"
            autoComplete="organization"
          />
        </label>
        <label className="checkout-field">
          Email *
          <input
            type="email"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            placeholder="email@dominio.com"
            autoComplete="email"
          />
        </label>
        <label className="checkout-field">
          Telefone
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => set("phone", event.target.value)}
            placeholder="+258 84 000 0000"
            autoComplete="tel"
          />
        </label>
        <label className="checkout-field checkout-field-wide">
          Prazo desejado
          <SelectDropdown
            options={TIMELINES}
            value={form.timeline}
            onChange={(val) => set("timeline", val)}
            placeholder="Seleccione um prazo"
          />
        </label>
        <label className="checkout-field checkout-field-wide">
          Descreva o projeto *
          <textarea
            rows={5}
            value={form.message}
            onChange={(event) => set("message", event.target.value)}
            placeholder="Objetivo do site, páginas pretendidas, produtos/serviços, referências que gosta…"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="checkout-actions">
        <button className="button" type="submit" disabled={sending}>
          {sending ? "A enviar…" : "Receber proposta →"}
        </button>
      </div>
    </form>
  );
}