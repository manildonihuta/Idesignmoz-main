"use client";

import * as React from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cx } from "./primitives";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
  className?: string;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

/**
 * Accessible modal dialog built on framer-motion. Closes on Escape,
 * click on the overlay, or the close button, and locks body scroll.
 */
export function Modal({ open, onClose, title, description, children, size = "md", footer, className }: ModalProps) {
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

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Diálogo"}>
          <motion.div
            key="overlay"
            className="absolute inset-0 rounded-sm bg-black/60 backdrop-blur-sm"
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
              "relative w-full overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl",
              sizes[size],
              className,
            )}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-4 top-4 grid size-8 place-content-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:border-brand hover:text-brand"
            >
              <X className="size-4" />
            </button>
            {title && (
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-paper">{title}</h3>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
            )}
            <div className={cx("mt-4", footer && "pb-4")}>{children}</div>
            {footer && <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line pt-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}