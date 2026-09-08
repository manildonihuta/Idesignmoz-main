"use client";

import * as React from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cx } from "./primitives";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  side?: "left" | "right";
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Side panel that slides in from the edge, used for mobile menus,
 * filters, and quick-edit surfaces.
 */
export function Drawer({ open, onClose, title, children, side = "right", footer, className }: DrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const offset = side === "right" ? { x: "100%" } : { x: "-100%" };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Painel"}>
          <motion.div
            key="overlay"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            role="document"
            className={cx(
              "absolute inset-y-0 flex w-full max-w-sm flex-col border-line bg-surface shadow-xl",
              side === "right" ? "right-0 border-l" : "left-0 border-r",
              className,
            )}
            initial={{ x: offset.x }}
            animate={{ x: 0 }}
            exit={{ x: offset.x }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              {title ? <h3 className="text-base font-semibold tracking-tight text-paper">{title}</h3> : <span />}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="grid size-8 place-content-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}