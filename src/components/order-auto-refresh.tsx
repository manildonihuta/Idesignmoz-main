"use client";

import { useEffect } from "react";

/** Auto-reloads while an order is still being processed so the confirmation
 * page reflects the real activation state once provisioning completes. */
export function OrderAutoRefresh({ pending }: { pending: boolean }) {
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => window.location.reload(), 15000);
    return () => clearTimeout(timer);
  }, [pending]);
  return null;
}