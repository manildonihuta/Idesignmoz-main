"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  LayoutTemplate,
  Sparkles,
  Search,
  Globe,
  Server,
  Mail,
  Newspaper,
  Users,
  MessageCircle,
  LifeBuoy,
} from "lucide-react";
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
  {
    label: "Serviços",
    menu: [
      {
        title: "Websites",
        items: [
          {
            label: "Pacotes de Websites",
            description: "Sites prontos a lançar",
            icon: LayoutTemplate,
            href: "/websites",
          },
          {
            label: "Website por Encomenda",
            description: "Proposta personalizada",
            icon: Sparkles,
            href: "/websites/brief",
          },
        ],
      },
      {
        title: "Domínios",
        items: [
          {
            label: "Pesquisar Domínio",
            description: "Verifica disponibilidade",
            icon: Search,
            href: "/domains/search",
          },
          {
            label: "Registar Domínio",
            description: "Garante o teu endereço",
            icon: Globe,
            href: "/domains",
          },
        ],
      },
      {
        title: "Alojamento & Email",
        items: [
          {
            label: "Alojamento Web",
            description: "Espaço para o teu site",
            icon: Server,
            href: "/hosting",
          },
          {
            label: "Email Profissional",
            description: "Comunica com o teu domínio",
            icon: Mail,
            href: "/hosting",
          },
        ],
      },
    ],
  },
  { label: "Websites", href: "/websites" },
  { label: "Domínios", href: "/domains" },
  { label: "Alojamento", href: "/hosting" },
  { label: "Trabalhos", href: "/portfolio", anchor: "#work" },
  { label: "Preços", href: "/pricing" },
  {
    label: "Recursos",
    menu: [
      {
        title: "Empresa",
        items: [
          {
            label: "Sobre Nós",
            description: "Conhece a IDesign Moz",
            icon: Users,
            href: "/about",
          },
          {
            label: "Contacto",
            description: "Fala connosco",
            icon: MessageCircle,
            href: "/contact",
          },
        ],
      },
      {
        title: "Blog & Ajuda",
        items: [
          {
            label: "Blog",
            description: "Artigos e novidades",
            icon: Newspaper,
            href: "/blog",
          },
          {
            label: "Ajuda",
            description: "Suporte e perguntas",
            icon: LifeBuoy,
            href: "/contact",
          },
        ],
      },
    ],
  },
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