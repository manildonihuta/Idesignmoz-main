"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, CircleUserRound, CreditCard, ReceiptText, Settings, LogOut, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "./avatar";
import { cn } from "@/lib/utils";

export interface AccountMenuProps {
  name?: string;
  email?: string;
  onSignOut: () => void;
  onNavigate?: () => void;
}

function initialOf(name: string | undefined, email: string | undefined) {
  const source = (name || email || "?").trim();
  const [first, second] = source.includes(" ")
    ? source.split(/\s+/)
    : source.startsWith("?")
      ? ["?"]
      : [source.slice(0, 1)];
  return ((first ?? "?")[0] + (second?.[0] ?? "")).toUpperCase();
}

type AccountItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect: () => void;
  destructive?: boolean;
};

/**
 * Popover glass do avatar (acesso ao painel): mesma linguagem visual do
 * NotificationPopover — painel escuro translúcido com blur, entrada motion
 * e itens que deslizam com blur.
 */
export function AccountMenu({ name, email, onSignOut, onNavigate }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = initialOf(name, email);
  const go = () => {
    onNavigate?.();
    setOpen(false);
  };

  const items: AccountItem[] = [
    { id: "admin", label: "Painel", icon: LayoutDashboard, href: "/admin", onSelect: go },
    { id: "profile", label: "O meu perfil", icon: CircleUserRound, href: "/dashboard/profile", onSelect: go },
    { id: "subscriptions", label: "A minha assinatura", icon: CreditCard, href: "/dashboard/subscriptions", onSelect: go },
    { id: "invoices", label: "As minhas faturas", icon: ReceiptText, href: "/dashboard/invoices", onSelect: go },
    { id: "settings", label: "Definições da conta", icon: Settings, href: "/dashboard/profile", onSelect: go },
    {
      id: "signout",
      label: "Sair",
      icon: LogOut,
      destructive: true,
      onSelect: () => {
        setOpen(false);
        onSignOut();
      },
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Conta"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-2 text-paper transition-colors duration-300 hover:border-brand hover:text-brand"
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-ok ring-2 ring-surface" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Conta"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-xl border border-[#ffffff1A] bg-[#111111E6] shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 border-b border-[#ffffff1A] p-4">
              <Avatar className="size-10 flex-none">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">{name ?? "Utilizador"}</span>
                <span className="block truncate text-xs text-white opacity-60">{email}</span>
              </div>
            </div>

            <div className="py-1">
              {items.map((item, index) => {
                const Icon = item.icon;
                const rowClass = cn(
                  "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-white transition-colors hover:bg-[#ffffff37]",
                  item.destructive && "text-white opacity-80 hover:text-[#ff5d76] hover:opacity-100",
                );
                const inner = (
                  <>
                    <Icon className="size-[18px] opacity-80 group-hover:opacity-100" aria-hidden="true" />
                    <span>{item.label}</span>
                  </>
                );
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 16, filter: "blur(8px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.25, delay: 0.04 + index * 0.05 }}
                  >
                    {item.href ? (
                      <Link href={item.href} onClick={item.onSelect} className={cn("group", rowClass)} role="menuitem">
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={item.onSelect} className={cn("group", rowClass)} role="menuitem">
                        {inner}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}