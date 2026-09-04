"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

interface SiteHeaderProps {
  anchors?: boolean;
}

type SessionUser = { email?: string; fullName?: string } | null;

function userFromSession(session: import("@supabase/supabase-js").Session | null): SessionUser {
  if (!session?.user) return null;
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  return {
    email: session.user.email,
    fullName: typeof meta?.full_name === "string" && meta.full_name ? meta.full_name : session.user.email,
  };
}

export function SiteHeader({ anchors = false }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<SessionUser>(null);
  const [ready, setReady] = useState(false);
  const close = () => setMenuOpen(false);
  const href = (a: string, anchor: string) => (anchors ? anchor : a);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!active) return;
      setUser(userFromSession(data.session));
      setReady(true);
    }

    load();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      setUser(userFromSession(session));
      setReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    setUser(null);
  }

  return (
    <header className="navbar" aria-label="Navegação principal">
      <Link className="logo" href={anchors ? "#top" : "/"} aria-label="Página inicial da IDesign Moz"><span>ID</span>ESIGN<span className="logo-accent">.</span></Link>
      <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
        <Link href={href("/services", "#services")} onClick={close}>Serviços</Link>
        <Link href={href("/hosting", "#hosting")} onClick={close}>Alojamento</Link>
        <Link href={href("/portfolio", "#work")} onClick={close}>Trabalhos</Link>
        <Link href={href("/pricing", "#pricing")} onClick={close}>Preços</Link>
        {ready ? (
          user ? (
            <>
              <span className="nav-login nav-user" title={user.email}>{user.fullName}</span>
              <Link className="nav-login" href="/admin" onClick={close}>Admin</Link>
              <button type="button" className="nav-login" onClick={signOut}>Sair</button>
            </>
          ) : (
            <Link className="nav-login" href="/login" onClick={close}>Entrar</Link>
          )
        ) : null}
        <Link className="button button-small" href={href("/contact", "#contact")} onClick={close}>Começar <Arrow /></Link>
      </nav>
      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
      >
        <span /><span />
      </button>
    </header>
  );
}
