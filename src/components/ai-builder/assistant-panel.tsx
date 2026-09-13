"use client";

import { useRef, useState } from "react";

import type { ParsedSection } from "@/lib/ai/builder-schema";

type ChatMessage = { role: "user" | "assistant"; text: string };

const QUICK_ACTIONS = [
  "Adiciona uma secção de FAQ à página",
  "Escreve um novo texto para a primeira secção",
  "Usa o vermelho #E31E24 como cor principal",
  "Torna os textos mais profissionais",
];

type AssistantActionPayload =
  | { action: "addSection"; section: ParsedSection }
  | { action: "rewrite"; index: number; section: ParsedSection }
  | { action: "setTheme"; theme: Record<string, unknown> }
  | { action: "respond"; text: string };

export function AssistantPanel({
  siteId,
  pageId,
  onAddSection,
  onRewriteSection,
  onSetTheme,
}: {
  siteId: string;
  pageId?: string;
  onAddSection: (section: ParsedSection) => void;
  onRewriteSection: (index: number, section: ParsedSection) => void;
  onSetTheme: (themePatch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Olá! Sou o assistente do seu editor. Peça-me para adicionar ou reescrever secções, mudar as cores ou a tipografia do site.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  function push(message: ChatMessage) {
    setMessages((m) => [...m, message]);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function send(text: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    push({ role: "user", text: message });
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-builder/sites/${siteId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, pageId }),
      });
      const data = await res.json();
      if (!data.ok || !data.action) {
        push({ role: "assistant", text: data.error ?? "Não consegui processar o pedido. Tente novamente." });
        return;
      }
      const action = data.action as AssistantActionPayload;
      switch (action.action) {
        case "addSection":
          onAddSection(action.section);
          push({ role: "assistant", text: "Pronto! Adicionei a nova secção no fim da página." });
          break;
        case "rewrite":
          onRewriteSection(action.index, action.section);
          push({ role: "assistant", text: "Secção reescrita. Veja como ficou na pré-visualização." });
          break;
        case "setTheme":
          onSetTheme(action.theme);
          push({ role: "assistant", text: "Tema atualizado. As cores e a tipografia já foram aplicadas." });
          break;
        case "respond":
          push({ role: "assistant", text: action.text });
          break;
      }
    } catch {
      push({ role: "assistant", text: "Falha de ligação. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="ai-font fixed bottom-6 right-6 z-[70] flex h-[440px] w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-[var(--ai-border-strong)] bg-[var(--ai-surface)] shadow-2xl">
          <div className="ai-gradient-bg flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              🤖 Assistente IA
            </span>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm text-white hover:bg-white/30"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
            >
              ✕
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ai-gradient-bg ml-auto text-white"
                    : "border border-[var(--ai-border)] bg-[var(--ai-surface-2)] text-[var(--ai-ink)]"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-[var(--ai-muted)]">
                <span className="ai-status-dot generating" />
                A pensar…
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--ai-border)] p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-full border border-[var(--ai-border)] px-2.5 py-1 text-[11px] text-[var(--ai-muted)] hover:border-[var(--ai-brand-soft)] hover:text-[var(--ai-ink)]"
                  onClick={() => send(q)}
                  disabled={busy}
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                className="ai-input !py-2 text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex.: adiciona uma secção de serviços"
                maxLength={600}
                disabled={busy}
              />
              <button
                type="submit"
                className="ai-btn !px-4 !py-2 text-sm"
                disabled={busy || !input.trim()}
                aria-label="Enviar"
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="ai-btn ai-gradient-anim fixed bottom-6 right-6 z-[70] h-14 w-14 !rounded-full !p-0 text-xl"
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir assistente IA"
      >
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}