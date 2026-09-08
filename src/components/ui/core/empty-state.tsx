"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";
import { Button } from "./primitives";
import { cx } from "./primitives";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  compact?: boolean;
}

/**
 * A friendly empty-state with optional call-to-action.
 * Used everywhere "nothing here yet" would otherwise be a blank page.
 */
export function EmptyState({ title, description, icon: Icon = SearchX, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <div className="grid size-12 place-content-center rounded-full bg-surface-2 text-muted">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-paper">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action &&
        (action.href ? (
          <Button href={action.href} variant="brand" size="sm" className="mt-6">
            {action.label}
          </Button>
        ) : (
          <Button onClick={action.onClick} variant="brand" size="sm" className="mt-6">
            {action.label}
          </Button>
        ))}
    </div>
  );
}

/* Convenience alias matching the existing admin "Empty" helper. */
export function Empty({ text, className }: { text: string; className?: string }) {
  return <p className={cx("py-10 text-center text-sm text-muted", className)}>{text}</p>;
}