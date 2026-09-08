"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Navbar, type NavItem } from "@/components/ui/core";

const HeaderAuth = dynamic(() => import("./site-header-auth").then((mod) => mod.HeaderAuth), {
  ssr: false,
  loading: () => <Link className="nav-login" href="/login">Entrar</Link>,
});

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

interface SiteHeaderProps {
  anchors?: boolean;
}

const track: NavItem[] = [
  { label: "Serviços", href: "/services" },
  { label: "Websites", href: "/websites" },
  { label: "Domínios", href: "/domains" },
  { label: "Alojamento", href: "/hosting" },
  { label: "Trabalhos", href: "/portfolio", anchor: "#work" },
  { label: "Preços", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

export function SiteHeader({ anchors = false }: SiteHeaderProps) {
  const ctaHref = anchors ? "#contact" : "/contact";
  const searchHref = anchors ? "#domains" : "/domains/search";

  return (
    <Navbar
      anchors={anchors}
      searchHref={searchHref}
      brand={
        <Link className="logo" href={anchors ? "#main" : "/"} aria-label="Página inicial da IDesign Moz">
          <Image src="/logo.png" alt="IDesign Moz" width={2065} height={762} sizes="180px" priority />
        </Link>
      }
      items={track}
      right={(onNavigate) => (
        <>
          <HeaderAuth onNavigate={onNavigate} />
          <Link className="button button-small nav-cta" href={ctaHref} onClick={onNavigate}>
            Começar <Arrow />
          </Link>
        </>
      )}
    />
  );
}