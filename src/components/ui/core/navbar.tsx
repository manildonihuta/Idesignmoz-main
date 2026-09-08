"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cx } from "./primitives";

export interface NavItem {
  label: string;
  href: string;
  /** When `anchors` is true, overrides the anchor derived from `href` (e.g. "/portfolio" -> "#work"). */
  anchor?: string;
}

export interface NavbarProps {
  brand: React.ReactNode;
  items: NavItem[];
  /** Node or render-prop that receives a close-navigation callback. */
  right?: React.ReactNode | ((onNavigate: () => void) => React.ReactNode);
  /** When true, item hrefs become in-page anchors (used on the landing page). */
  anchors?: boolean;
  searchHref?: string;
}

/**
 * Generic sticky top navigation bar with an accessible mobile menu.
 */
export function Navbar({ brand, items, right, anchors = false, searchHref = "/domains/search" }: NavbarProps) {
  const [open, setOpen] = React.useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  const renderRight = (onNavigate: () => void) => (typeof right === "function" ? right(onNavigate) : right);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        requestAnimationFrame(() => toggleRef.current?.focus());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const itemHref = (item: NavItem) => (anchors ? item.anchor ?? `#${item.href.split("/").filter(Boolean).pop()}` : item.href);

  return (
    <header className="navbar" aria-label="Navegação principal">
      <div className="nav-inner">
        {typeof brand === "string" ? <Link className="logo" href={anchors ? "#main" : "/"}>{brand}</Link> : brand}

        <nav className="nav-links">
          {items.map((item) => (
            <Link key={item.href} href={itemHref(item)} onClick={close}>
              {item.label}
            </Link>
          ))}
          <Link className="nav-search" href={searchHref} onClick={close} aria-label="Pesquisar">
            <Search size={14} aria-hidden="true" /> Pesquisar
          </Link>
          {renderRight(close)}
        </nav>

        <button
          ref={toggleRef}
          className={cx("menu-toggle", open && "open")}
          onClick={() => setOpen(!open)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-haspopup="menu"
        >
          <span />
          <span />
        </button>
      </div>

      <MobileMenu open={open} onClose={close} items={items} searchHref={searchHref} anchors={anchors} right={renderRight} />
    </header>
  );
}

export interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  searchHref?: string;
  anchors?: boolean;
  right?: React.ReactNode | ((onNavigate: () => void) => React.ReactNode);
}

/**
 * Slide-in mobile navigation drawer, wired up to the Navbar's state.
 */
export function MobileMenu({
  open,
  onClose,
  items,
  searchHref = "/domains/search",
  anchors = false,
  right,
}: MobileMenuProps) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const itemHref = (item: NavItem) => (anchors ? item.anchor ?? `#${item.href.split("/").filter(Boolean).pop()}` : item.href);
  const renderRight = typeof right === "function" ? right(onClose) : right;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="nav-overlay-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            className="nav-drawer-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <button className="drawer-close" onClick={onClose} aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            <nav className="no-scrollbar flex flex-col gap-6">
              {items.map((item) => (
                <Link key={item.href} href={itemHref(item)} onClick={onClose}>
                  {item.label}
                </Link>
              ))}
              <Link className="nav-drawer-search" href={searchHref} onClick={onClose}>
                <Search size={15} aria-hidden="true" /> Pesquisar
              </Link>
              {renderRight}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function CloseIcon() {
  return <X className="size-5" />;
}

export function MenuIcon() {
  return <Menu className="size-5" />;
}