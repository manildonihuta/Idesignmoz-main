"use client";

import Link from "next/link";
import { useState } from "react";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

interface SiteHeaderProps {
  anchors?: boolean;
}

export function SiteHeader({ anchors = false }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const href = (a: string, anchor: string) => (anchors ? anchor : a);

  return (
    <header className="navbar" aria-label="Navegação principal">
      <Link className="logo" href={anchors ? "#top" : "/"} aria-label="Página inicial da IDesign Moz"><span>ID</span>ESIGN<span className="logo-accent">.</span></Link>
      <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
        <Link href={href("/services", "#services")} onClick={close}>Serviços</Link>
        <Link href={href("/hosting", "#hosting")} onClick={close}>Alojamento</Link>
        <Link href={href("/portfolio", "#work")} onClick={close}>Trabalhos</Link>
        <Link href={href("/pricing", "#pricing")} onClick={close}>Preços</Link>
        <Link className="nav-login" href="/login" onClick={close}>Entrar</Link>
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
