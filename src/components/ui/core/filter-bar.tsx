"use client";

import * as React from "react";
import { cx } from "./primitives";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface CategoryTabsProps<T extends string> {
  options: FilterOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  className?: string;
}

/**
 * Horizontal scrolling category tabs (`.filter-row`/`.pricing-tabs` look).
 * Passing `null` corresponds to "all".
 */
export function CategoryTabs<T extends string>({ options, value, onChange, className }: CategoryTabsProps<T>) {
  return (
    <div className={cx("filter-row", className)} role="tablist" aria-label="Categorias">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        className={cx(value === null && "active")}
        onClick={() => onChange(null)}
      >
        Todas
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={cx(value === opt.value && "active")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.count != null ? ` (${opt.count})` : ""}
        </button>
      ))}
    </div>
  );
}

export interface FilterBarProps<T extends string> {
  options: FilterOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  label?: string;
  className?: string;
}

/**
 * Generic filter row (label + category tabs), commonly used on
 * catalog/blog listing pages.
 */
export function FilterBar<T extends string>({ options, value, onChange, label = "Filtrar", className }: FilterBarProps<T>) {
  return (
    <div className={cx("filter-row", className)}>
      <span>{label}</span>
      <button
        type="button"
        aria-pressed={value === null}
        className={cx(value === null && "active")}
        onClick={() => onChange(null)}
      >
        Todas
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          className={cx(value === opt.value && "active")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}