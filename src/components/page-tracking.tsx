"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { trackEvent } from "@/lib/analytics-client";

/**
 * Fires an anonymous `pageview` event on every route change.
 * Privacy-first: only an opaque visitor id + path are sent.
 */
export function PageTracking() {
  const pathname = usePathname();
  const last = useRef<string>("");

  useEffect(() => {
    let active = true;

    async function fire() {
      if (last.current === pathname) return;
      last.current = pathname;
      // avoid racing on the very first paint; fire in a microtask after mount
      trackEvent({ event: "pageview", page: pathname });
    }

    if (active) void fire();
    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
