"use client";

import * as React from "react";
import { cx } from "./primitives";

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-md bg-surface-2", className)}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface p-6", className)}>
      <Skeleton className="h-5 w-1/3" />
      <SkeletonText lines={3} className="mt-4" />
      <Skeleton className="mt-6 h-9 w-full" />
    </div>
  );
}

export function SkeletonGrid({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progressive loading                                                 */
/* ------------------------------------------------------------------ */

/**
 * A tiny state-machine designed for "progressive" data loading.
 * Screens render a skeleton first, then swap content in once ready,
 * letting you keep an old value on screen while refreshing.
 */
export function useProgressive<T>(initial: T | null) {
  const [data, setData] = React.useState<T | null>(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (fn: () => Promise<T>, opts?: { keep?: boolean }) => {
      setLoading(true);
      setError(null);
      if (!opts?.keep) setData(null);
      try {
        const result = await fn();
        setData(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { data, setData, loading, error, run };
}

/* ------------------------------------------------------------------ */
/* Optimistic UI                                                       */
/* ------------------------------------------------------------------ */

/**
 * Helper for optimistic mutations. `mutate` updates the cached value
 * immediately for snappy feedback, then reconciles with the server result.
 */
export function useOptimisticAction<T>(apply: (prev: T, next: T) => T) {
  const [value, setValue] = React.useState<T | null>(null);
  const [pending, setPending] = React.useState(false);

  const commit = React.useCallback(
    async (optimistic: T, run: () => Promise<T>) => {
      if (value !== null) setValue((prev) => (prev === null ? optimistic : apply(prev, optimistic)));
      setPending(true);
      try {
        const result = await run();
        setValue(result);
        return result;
      } finally {
        setPending(false);
      }
    },
    [apply, value],
  );

  return { value, setValue, pending, commit };
}

/* ------------------------------------------------------------------ */
/* Loading indicator (inline)                                          */
/* ------------------------------------------------------------------ */

export function LoadingIndicator({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-2 py-10 text-sm text-muted", className)} role="status">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
      <span className="sr-only">Loading</span>
    </div>
  );
}
