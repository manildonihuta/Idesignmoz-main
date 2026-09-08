"use client";

import * as React from "react";
import Link from "next/link";
import { cx } from "./primitives";

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

export interface FaqProps {
  items: FaqItem[];
  className?: string;
  /** Allow multiple open items (native details/summary). */
  multiple?: boolean;
}

/**
 * An accessible FAQ list built on native `<details>` elements.
 * Each item toggles independently and keyboard works out of the box.
 */
export function Faq({ items, className, multiple = true }: FaqProps) {
  const [open, setOpen] = React.useState<string | null>(null);

  return (
    <div className={cx("faq-list", className)}>
      {items.map((item) => {
        const isOpen = multiple ? undefined : open === item.question;
        return (
          <details
            key={item.question}
            className="faq-item"
            open={multiple ? undefined : isOpen}
            onToggle={(e) => {
              if (!multiple && (e.currentTarget as HTMLDetailsElement).open) {
                setOpen(item.question);
              }
            }}
          >
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CTA                                                                 */
/* ------------------------------------------------------------------ */

export interface CtaProps {
  mark?: React.ReactNode;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: { label: React.ReactNode; href: string };
  contactSlot?: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * End-of-page call-to-action section (`.cta-section` CSS).
 */
export function Cta({ mark, title, eyebrow, action, contactSlot, id, className }: CtaProps) {
  return (
    <section className={cx("cta-section section-wrap", className)} id={id}>
      <div className="cta-mark" aria-hidden="true">
        {mark ?? <span>↗</span>}
      </div>
      <div>
        {eyebrow != null && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {action && (
          <Link className="button" href={action.href}>
            {action.label}
          </Link>
        )}
      </div>
      {contactSlot && <div className="cta-contact">{contactSlot}</div>}
    </section>
  );
}