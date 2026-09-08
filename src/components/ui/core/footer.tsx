"use client";

import * as React from "react";
import Link from "next/link";

export interface FooterLink {
  label: string;
  href: string;
  /** When `anchors` is true, renders as `#<anchor>` instead of `href`. */
  anchor?: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  brand?: React.ReactNode;
  tagline?: React.ReactNode;
  columns?: FooterColumn[];
  note?: React.ReactNode;
  /** When true, links that define `anchor` become in-page anchors. */
  anchors?: boolean;
  legal?: React.ReactNode;
}

/**
 * Generic site footer with brand, tagline, titled link columns and legal line.
 * Renders into `.footer` with the brand block, one grid cell per column and
 * a full-width legal bar.
 */
export function Footer({ brand, tagline, columns, note, anchors = false, legal }: FooterProps) {
  const linkHref = (link: FooterLink) => (anchors && link.anchor ? `#${link.anchor}` : link.href);

  return (
    <footer className="footer section-wrap">
      <div className="footer-brand">
        {brand}
        {tagline && <p>{tagline}</p>}
      </div>

      {columns?.map((col) => (
        <nav className="footer-links footer-col" key={col.title} aria-label={col.title}>
          <h3 className="footer-col-title">{col.title}</h3>
          {col.links.map((link) => (
            <Link key={link.href} href={linkHref(link)}>
              {link.label}
            </Link>
          ))}
        </nav>
      ))}

      {note}
      {legal && <small className="footer-legal">{legal}</small>}
    </footer>
  );
}