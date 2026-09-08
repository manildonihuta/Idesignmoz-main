"use client";

import * as React from "react";
import { cx } from "./primitives";
import { Skeleton } from "./loading";
import { Empty } from "./empty-state";

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export interface Column<T> {
  key: string;
  header?: React.ReactNode;
  align?: "left" | "right" | "center";
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  empty?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
  footer?: React.ReactNode;
}

/**
 * Generic data table with a subtle editorial style (bordered rows,
 * mono uppercase headers) shared across the dashboard.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  className,
  empty,
  loading,
  loadingRows = 5,
  footer,
}: TableProps<T>) {
  const align = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className={cx("overflow-x-auto rounded-xl border border-line bg-surface", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cx(
                  "border-b border-line px-4 py-3 text-[10px] font-mono uppercase tracking-[.1em] text-muted",
                  align(col.align),
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="border-b border-line/60 px-4 py-3">
                    <Skeleton className="h-3.5 w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4">
                {empty ?? <Empty text="Sem dados." />}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  "border-b border-line/60 transition-colors last:border-0",
                  onRowClick && "cursor-pointer hover:bg-ink",
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cx("px-4 py-3", align(col.align), col.className)}>
                    {col.render(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  );
}

/**
 * Convenience wrapper: stateful DataTable with client-side sorting and
 * built-in loading/empty handling.
 */
export interface DataTableProps<T> extends TableProps<T> {
  sortable?: boolean;
  initialSort?: { key: string; dir: "asc" | "desc" };
}

export function DataTable<T>({ sortable = false, initialSort, rows, columns, ...props }: DataTableProps<T>) {
  const [sort, setSort] = React.useState(initialSort ?? null);

  const sorted =
    sort == null
      ? rows
      : [...rows].sort((a, b) => {
          const col = columns.find((c) => c.key === sort.key);
          const av = String(col?.render(a, 0) ?? "");
          const bv = String(col?.render(b, 0) ?? "");
          const cmp = av.localeCompare(bv);
          return sort.dir === "asc" ? cmp : -cmp;
        });

  return (
    <Table
      columns={
        sortable
          ? columns.map((col) => ({
              ...col,
              header: (
                <button
                  type="button"
                  onClick={() =>
                    setSort((prev) =>
                      prev?.key === col.key
                        ? { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" }
                        : { key: col.key, dir: "asc" },
                    )
                  }
                  className={cx(
                    "uppercase tracking-[.1em]",
                    sort?.key === col.key && "text-brand",
                  )}
                >
                  {col.header}
                  {sort?.key === col.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ),
            }))
          : columns
      }
      rows={sorted}
      {...props}
    />
  );
}