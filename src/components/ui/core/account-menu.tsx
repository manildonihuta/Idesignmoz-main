"use client";

import Link from "next/link";
import { LayoutDashboard, CircleUserRound, CreditCard, ReceiptText, Settings, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "./avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./dropdown-menu";

export interface AccountMenuProps {
  name?: string;
  email?: string;
  onSignOut: () => void;
  onNavigate?: () => void;
}

const itemClass = "cursor-pointer gap-2";

function initialOf(name: string | undefined, email: string | undefined) {
  const source = (name || email || "?").trim();
  const [first, second] = source.includes(" ")
    ? source.split(/\s+/)
    : source.startsWith("?")
      ? ["?"]
      : [source.slice(0, 1)];
  return ((first ?? "?")[0] + (second?.[0] ?? "")).toUpperCase();
}

/**
 * Avatar drop-down for the navbar (panel access): real session user + real
 * dashboard routes + sign out. Adapts the shadcn dropdown-menu-01 pattern to
 * the app design tokens.
 */
export function AccountMenu({ name, email, onSignOut, onNavigate }: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-2 text-paper transition-colors duration-300 hover:border-brand hover:text-brand"
          aria-label="Conta"
        >
          <Avatar className="size-8">
            <AvatarFallback>{initialOf(name, email)}</AvatarFallback>
          </Avatar>
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-ok ring-2 ring-surface" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-4 py-3">
            <Avatar className="size-10 flex-none">
              <AvatarFallback>{initialOf(name, email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-paper">{name ?? "Utilizador"}</span>
              <span className="block truncate text-xs text-muted">{email}</span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem className={itemClass} onSelect={() => onNavigate?.()}>
            <Link href="/admin" className="flex items-center gap-2">
              <LayoutDashboard size={18} aria-hidden="true" />
              <span>Painel</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onSelect={() => onNavigate?.()}>
            <Link href="/dashboard/profile" className="flex items-center gap-2">
              <CircleUserRound size={18} aria-hidden="true" />
              <span>O meu perfil</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onSelect={() => onNavigate?.()}>
            <Link href="/dashboard/subscriptions" className="flex items-center gap-2">
              <CreditCard size={18} aria-hidden="true" />
              <span>A minha assinatura</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onSelect={() => onNavigate?.()}>
            <Link href="/dashboard/invoices" className="flex items-center gap-2">
              <ReceiptText size={18} aria-hidden="true" />
              <span>As minhas faturas</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem className={itemClass} onSelect={() => onNavigate?.()}>
            <Link href="/dashboard/profile" className="flex items-center gap-2">
              <Settings size={18} aria-hidden="true" />
              <span>Definições da conta</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem destructive className={itemClass} onSelect={onSignOut}>
            <LogOut size={18} aria-hidden="true" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}