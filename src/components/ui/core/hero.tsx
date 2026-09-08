"use client";

import * as React from "react";
import { cx } from "./primitives";

export interface HeroProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center";
  split?: boolean;
  className?: string;
}

/**
 * Page hero block consistent with the existing `.page-hero` look.
 * `split` renders a two-column hero (heading left, trailing content right).
 */
export function Hero({ eyebrow, title, text, children, align = "left", split, className }: HeroProps) {
  return (
    <section className={cx("page-hero", split && "page-hero-split", className)}>
      {eyebrow != null && <p className="flex items-center gap-2.5 text-[10px] font-mono uppercase tracking-[.14em] text-muted">{eyebrow}</p>}
      <h1 property="name">{title}</h1>
      {text && <p>{text}</p>}
      {children && <div className={cx(align === "center" && "self-center", "mt-8")}>{children}</div>}
    </section>
  );
}