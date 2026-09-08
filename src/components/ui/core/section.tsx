"use client";

import * as React from "react";
import { cx } from "./primitives";

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  intro?: React.ReactNode;
  right?: React.ReactNode;
  container?: boolean;
}

/**
 * Standard marketing section wrapper with kicker/title/intro header row.
 */
export function Section({ kicker, title, intro, right, container = true, className, children, ...props }: SectionProps) {
  return (
    <section className={className} {...props}>
      <div className={cx(container && "section-wrap")}>
        {(kicker || title || intro) && (
          <div className="section-head-row">
            {kicker && (
              <p className="section-kicker">
                <span aria-hidden="true">/</span>
                {kicker}
              </p>
            )}
            {title && <h2>{title}</h2>}
            {(intro || right) && (
              <div className="section-intro-row">
                {intro && <p>{intro}</p>}
                {right}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}