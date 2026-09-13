"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type AssistantChatMessage = { role: "user" | "assistant"; text: string };

export type AssistantCategory = {
  id: string;
  label: string;
  icon: ReactNode;
  panelTitle: string;
  items: string[];
};

export type AssistantToggle = {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
};

export type AIAssistantInterfaceProps = {
  title: string;
  subtitle?: string;
  placeholder?: string;
  busyLabel?: string;
  categories: AssistantCategory[];
  toggles?: AssistantToggle[];
  initialMessages?: AssistantChatMessage[];
  className?: string;
  onClose?: () => void;
  /** Called each send. Returns the assistant reply text that gets appended. */
  onSend: (message: string, options: { toggles: string[] }) => Promise<string>;
};

export function AIAssistantInterface({
  title,
  subtitle,
  placeholder = "Escreva o que pretende fazer…",
  busyLabel = "A pensar…",
  categories,
  toggles = [],
  initialMessages,
  className,
  onClose,
  onSend,
}: AIAssistantInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AssistantChatMessage[]>(initialMessages ?? []);
  const [busy, setBusy] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const activeToggleIds = toggles.filter((t) => activeToggles[t.id]).map((t) => t.id);

  function push(message: AssistantChatMessage) {
    setMessages((m) => [...m, message]);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function toggleCategory(id: string) {
    setActiveCategoryId((current) => (current === id ? null : id));
  }

  function selectSuggestion(text: string) {
    setInputValue(text);
    setActiveCategoryId(null);
    inputRef.current?.focus();
  }

  function toggleOption(id: string) {
    setActiveToggles((t) => ({ ...t, [id]: !t[id] }));
  }

  async function send(text?: string) {
    const message = (text ?? inputValue).trim();
    if (!message || busy) return;
    setInputValue("");
    push({ role: "user", text: message });
    setBusy(true);
    try {
      const reply = await onSend(message, { toggles: activeToggleIds });
      push({ role: "assistant", text: reply });
    } catch {
      push({ role: "assistant", text: "Falha de ligação. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden bg-[var(--ai-surface)] text-[var(--ai-ink)] ${className ?? ""}`}>
      {/* Header: logo + welcome */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 flex-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 200 200" width="100%" height="100%" className="h-full w-full">
              <g clipPath="url(#ai-logo-clip)">
                <mask id="ai-logo-mask" style={{ maskType: "alpha" }} width="200" height="200" x="0" y="0" maskUnits="userSpaceOnUse">
                  <path
                    fill="#fff"
                    fillRule="evenodd"
                    d="M100 150c27.614 0 50-22.386 50-50s-22.386-50-50-50-50 22.386-50 50 22.386 50 50 50zm0 50c55.228 0 100-44.772 100-100S155.228 0 100 0 0 44.772 0 100s44.772 100 100 100z"
                    clipRule="evenodd"
                  />
                </mask>
                <g mask="url(#ai-logo-mask)">
                  <path fill="#fff" d="M200 0H0v200h200V0z" />
                  <path fill="#e31e24" fillOpacity="0.62" d="M200 0H0v200h200V0z" />
                  <g filter="url(#ai-logo-blur)" className="animate-gradient">
                    <path fill="#e31e24" d="M110 32H18v68h92V32z" />
                    <path fill="#7c3aed" d="M188-24H15v98h173v-98z" />
                    <path fill="#ff5a5f" d="M175 70H5v156h170V70z" />
                    <path fill="#ff8f8f" d="M230 51H100v103h130V51z" />
                  </g>
                </g>
              </g>
              <defs>
                <filter id="ai-logo-blur" width="385" height="410" x="-75" y="-104" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                  <feGaussianBlur result="effect1_foregroundBlur" stdDeviation="40" />
                </filter>
                <clipPath id="ai-logo-clip">
                  <path fill="#fff" d="M0 0H200V200H0z" />
                </clipPath>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-0.5 max-w-[280px] text-xs leading-relaxed text-[var(--ai-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--ai-border)] text-[var(--ai-muted)] transition-colors hover:border-[var(--ai-border-strong)] hover:text-[var(--ai-ink)]"
            onClick={onClose}
            aria-label="Fechar assistente"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* Command suggestions */}
      <AnimatePresence>
        {activeCategory ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mt-3 overflow-hidden rounded-xl border border-[var(--ai-border)] bg-[var(--ai-surface-2)]">
              <div className="border-b border-[var(--ai-border)] px-3 py-2">
                <h3 className="text-xs font-bold text-[var(--ai-ink)]">{activeCategory.panelTitle}</h3>
              </div>
              <ul className="max-h-44 divide-y divide-[var(--ai-border)] overflow-y-auto">
                {activeCategory.items.map((item, index) => (
                  <motion.li key={item} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }}>
                    <button
                      type="button"
                      onClick={() => selectSuggestion(item)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--ai-ink)] transition-colors duration-75 hover:bg-[var(--ai-surface)]"
                    >
                      <span className="flex-none text-[var(--ai-brand-soft)]">{activeCategory.icon}</span>
                      <span>{item}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Chat */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--ai-muted)]">
            Escreva abaixo o que pretende alterar no site.
          </div>
        ) : (
          messages.map((m, index) => (
            <div
              key={index}
              className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "ai-gradient-bg ml-auto text-white"
                  : "border border-[var(--ai-border)] bg-[var(--ai-surface-2)] text-[var(--ai-ink)]"
              }`}
            >
              {m.text}
            </div>
          ))
        )}
        {busy ? (
          <div className="flex items-center gap-2 text-xs text-[var(--ai-muted)]">
            <span className="ai-status-dot generating" />
            {busyLabel}
          </div>
        ) : null}
      </div>

      {/* Footer: composer + options + categories */}
      <div className="border-t border-[var(--ai-border)] p-3">
        <div className="overflow-hidden rounded-xl border border-[var(--ai-border)] bg-[var(--ai-surface-2)]">
          <div className="flex items-center gap-2 p-2.5">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={placeholder}
              maxLength={600}
              disabled={busy}
              className="w-full bg-transparent text-sm text-[var(--ai-ink)] outline-none placeholder:text-[var(--ai-muted)]"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!inputValue.trim() || busy}
              className="grid h-8 w-8 flex-none place-items-center rounded-full ai-gradient-bg transition-opacity disabled:opacity-40"
              aria-label="Enviar"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          {toggles.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--ai-border)] px-2.5 py-2">
              {toggles.map((t) => {
                const active = Boolean(activeToggles[t.id]);
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.hint}
                    onClick={() => toggleOption(t.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-[var(--ai-brand-soft)] bg-[var(--ai-gradient-soft)] text-[var(--ai-ink)]"
                        : "border-[var(--ai-border)] text-[var(--ai-muted)] hover:border-[var(--ai-border-strong)] hover:text-[var(--ai-ink)]"
                    }`}
                  >
                    {t.icon ? <span className={active ? "text-[var(--ai-brand-soft)]" : ""}>{t.icon}</span> : null}
                    {t.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {categories.map((c) => {
            const active = activeCategoryId === c.id;
            return (
              <motion.button
                key={c.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => toggleCategory(c.id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-[var(--ai-brand-soft)] bg-[var(--ai-gradient-soft)] text-[var(--ai-ink)]"
                    : "border-[var(--ai-border)] text-[var(--ai-muted)] hover:border-[var(--ai-border-strong)] hover:text-[var(--ai-ink)]"
                }`}
              >
                <span className={active ? "text-[var(--ai-brand-soft)]" : ""}>{c.icon}</span>
                {c.label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}