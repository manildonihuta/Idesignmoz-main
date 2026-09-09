"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/ui/core/account-menu";

type SessionUser = { email?: string; fullName?: string } | null;

interface HeaderAuthProps {
  onNavigate?: () => void;
}

export function HeaderAuth({ onNavigate }: HeaderAuthProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/auth/session");
        const data = (await res.json()) as { user?: { email?: string; fullName?: string } };
        if (!active) return;
        setUser(data.user ?? null);
        setReady(true);
      } catch {
        if (!active) return;
        setUser(null);
        setReady(true);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [pathname]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }

  if (!ready) return null;

  if (!user) {
    return (
      <Link className="nav-login" href="/login" onClick={onNavigate}>Entrar</Link>
    );
  }

  return (
    <AccountMenu
      name={user.fullName}
      email={user.email}
      onSignOut={() => void signOut()}
      onNavigate={onNavigate}
    />
  );
}