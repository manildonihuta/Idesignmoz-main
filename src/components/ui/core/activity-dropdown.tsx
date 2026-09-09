"use client";

import * as React from "react";
import { Bell, ChevronUp } from "lucide-react";
import { cx } from "./primitives";

export interface ActivityItem {
  id: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  time: string;
  href?: string;
}

export interface ActivityDropdownProps {
  items: ActivityItem[];
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  open: boolean;
  onToggle: () => void;
  className?: string;
  emptyText?: string;
  /** Extra per-item content (e.g. a "mark as read" action). */
  renderItemExtra?: (item: ActivityItem) => React.ReactNode;
}

/**
 * Activity-dropdown effect (accordion grid-rows + staggered item reveal +
 * rotating chevron + rounded-corner morph). Data-driven; use the app design
 * tokens so it matches light/dark surfaces.
 */
export function ActivityDropdown({
  items,
  title,
  subtitle,
  icon: HeaderIcon = Bell,
  open,
  onToggle,
  className,
  emptyText = "Sem atividades.",
  renderItemExtra,
}: ActivityDropdownProps) {
  return (
    <div
      className={cx(
        "w-full max-w-md overflow-hidden border border-line bg-surface select-none",
        "shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
        "transition-all duration-500 ease-in-out",
        open ? "rounded-3xl" : "rounded-2xl",
        className,
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 p-4 text-left"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 transition-colors duration-300">
          <HeaderIcon className="size-5 text-muted" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-paper">{title}</span>
          {subtitle && (
            <span
              className={cx(
                "block text-sm text-muted",
                "transition-all duration-500 ease-in-out",
                open ? "mt-0 max-h-0 opacity-0" : "mt-0.5 max-h-6 opacity-100",
              )}
            >
              {subtitle}
            </span>
          )}
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center">
          <ChevronUp
            className={cx(
              "size-5 text-muted transition-transform duration-500 ease-in-out",
              open ? "rotate-0" : "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Items (accordion) */}
      <div
        className={cx(
          "grid transition-all duration-500 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-2 pb-4">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted">{emptyText}</p>
            ) : (
              <div className="space-y-1">
                {items.map((item, index) => {
                  const ItemIcon = item.icon;
                  const inner = (
                    <span className="flex min-w-0 items-start gap-3">
                      {ItemIcon && (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 transition-colors duration-300 group-hover:bg-brand/10 group-hover:text-brand">
                          <ItemIcon className="size-4" aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-paper">{item.title}</span>
                        {item.description && (
                          <span className="block truncate text-sm text-muted">{item.description}</span>
                        )}
                        {renderItemExtra?.(item)}
                      </span>
                      <span className="shrink-0 pt-0.5 text-xs text-muted">{item.time}</span>
                    </span>
                  );
                  return (
                    <div
                      key={item.id}
                      className={cx(
                        "group rounded-xl p-3",
                        "transition-all duration-500 ease-in-out",
                        "hover:bg-surface-2",
                        open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                      )}
                      style={{ transitionDelay: open ? `${index * 60}ms` : "0ms" }}
                    >
                      {item.href ? (
                        <a href={item.href} className="flex min-w-0 items-start gap-3">
                          {inner}
                        </a>
                      ) : (
                        inner
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}