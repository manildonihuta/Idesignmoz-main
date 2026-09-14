"use client";

import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";

export function cx(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-2xl border border-line bg-surface p-6 shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("mb-4 flex flex-wrap items-end justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cx("text-sm font-semibold text-paper", className)} {...props} />;
}

export function CardDesc({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("mt-0.5 text-sm text-muted", className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        brand: "bg-brand text-white hover:bg-brand-hover",
        brandOutline: "border border-brand/40 text-brand hover:bg-brand/10",
        ghost: "border border-line bg-surface-2 text-paper hover:border-brand hover:bg-ink",
        soft: "bg-brand/15 text-brand hover:bg-brand/25",
        ok: "bg-ok/15 text-ok hover:bg-ok/25",
        glass: "bg-[#11111198] text-white backdrop-blur-sm hover:bg-[#111111d1]",
        ghostGlass: "text-white opacity-80 hover:bg-[#ffffff20] hover:opacity-100 disabled:opacity-40",
      },
      size: {
        sm: "rounded-md px-2.5 py-1 text-xs",
        md: "rounded-lg px-4 py-2 text-sm",
        lg: "rounded-lg px-6 py-3 text-base",
        icon: "size-10 rounded-xl",
      },
    },
    defaultVariants: { variant: "brand", size: "md" },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  href?: string;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, href, loading, children, disabled, ...props },
  ref,
) {
  const classes = cx(buttonVariants({ variant, size }), className);

  if (href) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled}>
        {loading ? <Spinner /> : children}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} disabled={loading || disabled} {...props}>
      {loading ? <Spinner /> : children}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/* StatusBadge                                                         */
/* ------------------------------------------------------------------ */

export type StatusTone = "brand" | "ok" | "warn" | "muted" | "danger";

const statusTones: Record<StatusTone, string> = {
  brand: "bg-brand text-white",
  ok: "bg-ok/15 text-ok",
  warn: "bg-brand/15 text-paper border border-brand/40",
  muted: "bg-surface-2 text-muted",
  danger: "border border-brand/40 text-brand",
};

export function StatusBadge({
  tone = "muted",
  className,
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* Convenience alias matching the existing admin "Pill" naming */
export const Pill = StatusBadge;

/* ------------------------------------------------------------------ */
/* Icon                                                               */
/* ------------------------------------------------------------------ */

/** A small icon tile used throughout cards/dashboards. */
export function IconTile({
  tone = "brand",
  className,
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<StatusTone, string> = {
    brand: "bg-brand/10 text-brand",
    ok: "bg-ok/10 text-ok",
    warn: "bg-brand/15 text-brand",
    muted: "bg-surface-2 text-muted",
    danger: "bg-brand/10 text-brand",
  };
  return (
    <div className={cx("grid size-10 place-content-center rounded-lg", tones[tone], className)}>{children}</div>
  );
}
