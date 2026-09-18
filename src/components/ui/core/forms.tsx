"use client";

import * as React from "react";
import { Search, ChevronDown } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./primitives";

/* ------------------------------------------------------------------ */
/* SearchBar                                                           */
/* ------------------------------------------------------------------ */

export interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  onSearch?: (value: string) => void;
  size?: "sm" | "md";
  debounceMs?: number;
  icon?: boolean;
}

/**
 * Debounced, controlled search input with a leading search icon.
 * The parent owns `value`/`onValueChange`; `onSearch` fires after typing
 * pauses (`debounceMs`, default 300ms).
 */
export function SearchBar({
  value,
  onValueChange,
  onSearch,
  size = "md",
  debounceMs = 300,
  icon = true,
  className,
  ...props
}: SearchBarProps) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      onValueChange(next);
      if (timer.current) clearTimeout(timer.current);
      if (!onSearch) return;
      timer.current = setTimeout(() => onSearch(next), debounceMs);
    },
    [onValueChange, onSearch, debounceMs],
  );

  return (
    <div className={cx("relative w-full", size === "sm" ? "max-w-xs" : "max-w-md", className)}>
      {icon && (
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      )}
      <input
        type="search"
        value={value}
        onChange={handleChange}
        className={cx(
          "w-full rounded-lg border border-line bg-surface-2 text-paper outline-none transition-colors placeholder:text-muted focus:border-brand",
          size === "sm" ? "py-1.5 pl-9 pr-3 text-xs" : "py-2 pl-9 pr-3 text-sm",
        )}
        {...props}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

export const inputVariants = cva(
  "w-full rounded-lg border border-line bg-surface-2 text-paper outline-none focus:outline-none focus:ring-0 transition-colors placeholder:text-muted",
  {
    variants: {
      size: {
        sm: "px-2.5 py-1.5 text-xs",
        md: "px-3 py-2 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type InputVariants = VariantProps<typeof inputVariants>;

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">, InputVariants {
  label?: React.ReactNode;
  error?: string | null;
  hint?: React.ReactNode;
  help?: React.ReactNode;
  size?: "sm" | "md";
}

export function TextField({ label, error, hint, help, size, className, id, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-mono uppercase tracking-[.1em] text-muted">
          {label}
        </label>
      )}
      <input id={inputId} className={cx(inputVariants({ size }), error && "border-brand/70")} {...props} />
      {help && !error && <p className="text-xs text-muted">{help}</p>}
      {error && <p className="text-xs text-brand">{error}</p>}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">, InputVariants {
  label?: React.ReactNode;
  error?: string | null;
  size?: "sm" | "md";
  options: Array<{ value: string; label: string }>;
}

export function SelectField({ label, error, size, className, options, id, ...props }: SelectFieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-mono uppercase tracking-[.1em] text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <select id={inputId} className={cx(inputVariants({ size }), "appearance-none pr-8", error && "border-brand/70")} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
      {error && <p className="text-xs text-brand">{error}</p>}
    </div>
  );
}

export interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, InputVariants {
  label?: React.ReactNode;
  error?: string | null;
}

export function TextareaField({ label, error, size, className, id, ...props }: TextareaFieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-mono uppercase tracking-[.1em] text-muted">
          {label}
        </label>
      )}
      <textarea id={inputId} className={cx(inputVariants({ size }), "resize-y", error && "border-brand/70")} {...props} />
      {error && <p className="text-xs text-brand">{error}</p>}
    </div>
  );
}

/** Form row wrapper that arranges fields responsively. */
export function FormRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("grid grid-cols-1 gap-4 md:grid-cols-2", className)} {...props} />;
}

/** Form container with consistent vertical rhythm. */
export function Form({ className, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form className={cx("flex flex-col gap-5", className)} {...props} />;
}