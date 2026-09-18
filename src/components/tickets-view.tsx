"use client";

import { useState } from "react";

import type { ClientTicket } from "@/lib/client-data";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type SupportTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

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

function fmtSize(bytesLabel: string): string {
  return bytesLabel;
}

function mapDbTicket(t: ClientTicket): SupportTicket {
  return {
    id: t.number || t.id,
    subject: t.subject,
    category: (t.channel as TicketCategory) || "Other",
    priority: t.priority as TicketPriority,
    status: t.status as TicketStatus,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    messages: t.messages.map((m) => ({
      id: m.id,
      author: m.authorEmail === "suporte@idesignmoz.com" ? "Suporte" : "Cliente",
      text: m.body,
      date: m.createdAt,
    })),
  };
}

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("Technical Support");
  const [priority, setPriority] = useState<TicketPriority>("Normal");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const kb = Math.round(file.size / 1024);
      setFileSize(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
    }
  }

  async function submit() {
    if (!subject.trim() || !text.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/client/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: text.trim(),
          category,
          priority: priority.toLowerCase(),
        }),
      });
      if (res.ok) window.location.reload();
    } catch {
      /* ignore */
    }
    setSubmitting(false);
  }

  return (
    <div className="ticket-form">
      <h3>Novo ticket</h3>
      <label className="checkout-field">
        Assunto *
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Resumo do problema"
        />
      </label>
      <div className="ticket-form-grid">
        <div className="checkout-field flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/80">Categoria</span>
          <DropdownMenu
            options={TICKET_CATEGORIES.map((c) => ({
              label: c,
              onClick: () => setCategory(c),
            }))}
            className="w-full bg-[#11111198] text-white border border-white/10"
          >
            {category}
          </DropdownMenu>
        </div>
        <div className="checkout-field flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/80">Prioridade</span>
          <DropdownMenu
            options={TICKET_PRIORITIES.map((p) => ({
              label: p,
              onClick: () => setPriority(p),
            }))}
            className="w-full bg-[#11111198] text-white border border-white/10"
          >
            {priority}
          </DropdownMenu>
        </div>
      </div>
      <label className="checkout-field">
        Mensagem *
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Descreva o problema em detalhe…"
          rows={4}
        />
      </label>
      <label className="ticket-attach">
        <input type="file" onChange={handleFile} />
        <span className="button outline-button">
          {fileName ? `✓ ${fileName} (${fmtSize(fileSize)})` : "Anexar arquivo"}
        </span>
      </label>
      <div className="ticket-actions">
        <button className="outline-button" type="button" onClick={onDone}>
          Cancelar
        </button>
        <button className="button" type="button" onClick={submit} disabled={submitting}>
          {submitting ? "A enviar…" : "Criar ticket"}
        </button>
      </div>
    </div>
  );
}

function TicketThread({
  ticket,
  dbTicket,
}: {
  ticket: SupportTicket;
  dbTicket?: ClientTicket;
}) {
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sendReply() {
    if (!reply.trim()) return;
    setSubmitting(true);

    if (dbTicket) {
      try {
        const res = await fetch("/api/client/tickets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: dbTicket.id, body: reply.trim() }),
        });
        if (res.ok) window.location.reload();
      } catch {
        /* ignore */
      }
    }
    setReply("");
    setSubmitting(false);
  }

  return (
    <div className="ticket-thread">
      <div className="ticket-messages">
        {ticket.messages.map((m) => (
          <div className="ticket-message" key={m.id}>
            <div className="ticket-message-head">
              <strong>{m.author}</strong>
              <span>{fmtDate(m.date)}</span>
            </div>
            <p>{m.text}</p>
            {m.attachment ? (
              <span className="ticket-file">
                📎 {m.attachment.name} ({m.attachment.size})
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="ticket-reply">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Escreva a sua resposta…"
          rows={3}
        />
        <div className="ticket-reply-bar">
          <button className="button" type="button" onClick={sendReply} disabled={submitting}>
            {submitting ? "A enviar…" : "Responder"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPriority(priority: string): string {
  return priority;
}

export function TicketsView({ initialData }: { initialData?: ClientTicket[] }) {
  const tickets = (initialData ?? []).map(mapDbTicket);

  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const open = openId ? tickets.find((t) => t.id === openId) : undefined;
  const openDb = initialData?.find((t) => (t.number || t.id) === openId);

  if (open) {
    return (
      <div className="space-y-6">
        <div className="project-detail-head">
          <button className="outline-button" type="button" onClick={() => setOpenId(null)}>
            ← Voltar
          </button>
          <div>
            <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
              {open.id} · {open.subject}
            </h1>
            <p className="text-muted">
              {open.category} · {formatPriority(open.priority)} · Criado em {fmtDate(open.createdAt)}
            </p>
          </div>
        </div>

        <TicketThread ticket={open} dbTicket={openDb} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
            Tickets
          </h1>
          <p className="text-muted">Apoio técnico e suporte.</p>
        </div>
        <button className="button" type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "+ Novo ticket"}
        </button>
      </div>

      {showForm ? (
        <NewTicketForm onDone={() => setShowForm(false)} />
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {tickets.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
            Ainda não tem tickets.
          </div>
        )}
        {tickets.map((ticket) => (
          <button
            className="ticket-row"
            key={ticket.id}
            type="button"
            onClick={() => setOpenId(ticket.id)}
          >
            <div className="ticket-row-id">
              <strong>{ticket.id}</strong>
              <span className={`ticket-status-pill ${ticket.status.toLowerCase().replaceAll(" ", "-")}`}>
                {ticket.status}
              </span>
            </div>
            <div className="ticket-row-main">
              <p className="ticket-row-subject">{ticket.subject}</p>
              <p className="ticket-row-meta">
                {ticket.category} · {formatPriority(ticket.priority)} · Atualizado {fmtDate(ticket.updatedAt)}
              </p>
            </div>
            <span className="ticket-row-count">{ticket.messages.length} msg</span>
          </button>
        ))}
      </div>
    </div>
  );
}
