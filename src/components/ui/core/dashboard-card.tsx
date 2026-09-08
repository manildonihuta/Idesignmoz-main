"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./primitives";

export const dashboardCardVariants = cva(
  "flex flex-col rounded-xl border border-line bg-surface p-5 transition-colors",
  {
    variants: {
      interactive: {
        true: "cursor-pointer hover:border-brand",
        false: "",
      },
    },
    defaultVariants: { interactive: false },
  },
);

export interface DashboardCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dashboardCardVariants> {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "brand" | "ok" | "muted";
}

/**
 * Compact stat/card used across dashboard grids (value, label, optional icon).
 */
export function DashboardCard({ icon, label, value, sub, accent = "brand", interactive, className, children, ...props }: DashboardCardProps) {
  const accentCls = {
    brand: "text-brand",
    ok: "text-ok",
    muted: "text-muted",
  }[accent];

  return (
    <div className={cx(dashboardCardVariants({ interactive }), className)} {...props}>
      {children ?? (
        <>
          <div className="mb-4 flex items-center justify-between">
            {icon && <div className={cx("grid size-10 place-content-center rounded-lg bg-brand/10", accentCls)}>{icon}</div>}
            {value != null && <span className={cx("text-sm font-semibold", accentCls)}>{sub}</span>}
          </div>
          {label && <p className="text-sm font-medium text-muted">{label}</p>}
          {value != null && <p className="mt-1 text-[22px] font-bold tracking-tight text-paper">{value}</p>}
          {sub && value == null && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </>
      )}
    </div>
  );
}