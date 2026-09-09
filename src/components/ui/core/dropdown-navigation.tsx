"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export interface DropdownItem {
  label: string;
  description?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href: string;
}

export interface DropdownColumn {
  title: string;
  items: DropdownItem[];
}

export interface DropdownMenuProps {
  label: string;
  menu: DropdownColumn[];
  onNavigate?: () => void;
  /** Align the panel's right edge to the trigger (for items near the viewport edge). */
  alignEnd?: boolean;
}

/**
 * Hover-driven drop-down navigation item (framer-motion):
 * shared-layout pill behind the label, rotating chevron and an animated
 * grouped panel. Uses the app design tokens (surface/line/paper/muted/brand).
 */
export function DropdownMenu({ label, menu, onNavigate, alignEnd = false }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  const go = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setOpen((o) => !o);
  };

  const menuWithDelay = () => {
    let rowIndex = 0;
    return menu.map((column) => (
      <div className="min-w-[170px]" key={column.title}>
        <h3 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          {column.title}
        </h3>
        <ul className="space-y-5">
          {column.items.map((item) => {
            const Icon = item.icon;
            const delay = rowIndex * 0.045;
            rowIndex += 1;
            return (
              <motion.li
                key={item.href + item.label}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, delay, ease: "easeOut" }}
              >
                <Link href={item.href} onClick={onNavigate} className="group flex items-start gap-3">
                  {Icon && (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line text-paper transition-colors duration-300 group-hover:bg-brand/10 group-hover:text-brand">
                      <Icon className="size-5 flex-none" aria-hidden="true" />
                    </span>
                  )}
                  <span className="leading-5">
                    <span className="block text-sm font-medium text-paper transition-colors duration-300 group-hover:text-brand">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="block max-w-[180px] text-xs text-muted transition-colors duration-300 group-hover:text-paper">
                        {item.description}
                      </span>
                    )}
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    ));
  };

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={close}>
      <button
        type="button"
        className="group relative flex cursor-pointer items-center justify-center gap-1.5 py-1.5 px-3 text-[12px] font-bold text-muted transition-colors duration-300 hover:text-brand"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={go}
      >
        {open && (
          <motion.span
            layoutId="nav-pill"
            className="absolute inset-0 rounded-full bg-brand/10"
            transition={{ duration: 0.25 }}
          />
        )}
        <span className="relative z-10">{label}</span>
        <ChevronDown
          className={`relative z-10 h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <div className={`absolute top-full z-50 pt-3 ${alignEnd ? "right-0" : "left-0"}`}>
            <motion.div
              className="w-max border border-line bg-surface p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
              style={{ borderRadius: 16 }}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex w-fit gap-9 overflow-hidden">
                {menuWithDelay()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}