"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/ui/core/account-menu";

type SessionUser = { email?: string; fullName?: string } | null;

interface HeaderAuthProps {
  onNavigate?: () => void;
}

/* Cache da sessão em memória do módulo: o HeaderAuth é remontado em cada
 * navegação de página, mas o módulo sobrevive — assim o avatar nunca
 * desaparece enquanto a nova sessão é buscada. */
let cachedUser: SessionUser = null;
let cachedAt = 0;
let inflight: Promise<SessionUser> | null = null;

function fetchUserNow(): Promise<SessionUser> {
  if (!inflight) {
    inflight = fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data: { user?: { email?: string; fullName?: string } }) => data.user ?? null)
      .catch(() => null)
      .then((user) => {
        cachedUser = user;
        cachedAt = Date.now();
        return user;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function HeaderAuth({ onNavigate }: HeaderAuthProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser>(cachedUser);
  const [ready, setReady] = useState(() => cachedAt > 0);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const next = await fetchUserNow();
      if (!active) return;
      setUser(next);
      setReady(true);
    };
    void sync();
    return () => {
      active = false;
    };
  }, [pathname]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      cachedUser = null;
      cachedAt = 0;
      setUser(null);
    }
  }

  if (!ready) {
    return <span className="nav-auth-placeholder" aria-hidden="true" />;
  }

  return (
    <span key={user ? "account" : "login"} className="nav-auth">
      {user ? (
        <AccountMenu
          name={user.fullName}
          email={user.email}
          onSignOut={() => void signOut()}
          onNavigate={onNavigate}
        />
      ) : (
        <Link className="nav-login" href="/login" onClick={onNavigate}>
          Entrar
        </Link>
      )}
    </span>
  );
}