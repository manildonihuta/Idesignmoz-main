"use client";

import * as React from "react";
import { Check, Info, AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cx } from "./primitives";

export type ToastTone = "ok" | "error" | "info" | "brand";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (tone: ToastTone, message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/** Compat alias so existing admin code (`notify("ok", msg)`) can migrate. */
export type Notify = (tone: ToastTone, message: string) => void;

const toneIcon = {
  ok: Check,
  error: AlertTriangle,
  info: Info,
  brand: Info,
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = toneIcon[item.tone];
  const tones = {
    ok: "border-ok/40 text-ok",
    error: "border-brand/40 text-brand",
    info: "border-line text-muted",
    brand: "border-brand/40 text-brand",
  } as const;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cx(
        "flex items-center gap-3 rounded-xl border bg-surface p-3 pr-8 shadow-lg",
        tones[item.tone],
      )}
    >
      <Icon className="size-4 flex-none" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-paper">{item.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar notificação"
        className="absolute right-2.5 top-2.5 grid size-6 place-content-center rounded-md text-muted hover:text-paper"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((tone: ToastTone, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const remove = React.useCallback((id: string) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {items.map((item) => (
            <div key={item.id} className="pointer-events-auto relative">
              <ToastCard item={item} onClose={() => remove(item.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}