/* --------------------------------------------------------------------- *
 * Client-side anonymous analytics helpers.
 * Kept free of server-only imports so it can be bundled into client
 * components. Fire-and-forget beacon to POST /api/analytics/track.
 * --------------------------------------------------------------------- */

export type AnalyticsEventName =
  | "pageview"
  | "domain_search"
  | "signup"
  | "cart_add"
  | "checkout"
  | "purchase"
  | "customer";

export type TrackInput = {
  event: AnalyticsEventName;
  page?: string;
  value?: number;
  meta?: Record<string, unknown>;
};

/* --------------------------------------------------------------------- *
 * Get or create the anonymous visitor id (first-party cookie)
 * --------------------------------------------------------------------- */

export function getVisitorId(): string {
  if (typeof document === "undefined") return "";

  const COOKIE = "idm_vid";
  const existing = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));

  if (existing) {
    const v = existing.slice(COOKIE.length + 1);
    if (v) return v;
  }

  let id = "";
  try {
    id = crypto.randomUUID();
  } catch {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${COOKIE}=${id};path=/;max-age=${maxAge};SameSite=Lax`;
  return id;
}

/* --------------------------------------------------------------------- *
 * Fire an event to the tracking beacon (fire-and-forget)
 * --------------------------------------------------------------------- */

export function trackEvent(input: TrackInput): void {
  if (typeof window === "undefined") return;

  const visitorId = getVisitorId();
  const page = input.page ?? window.location.pathname;

  try {
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, event: input.event, page, value: input.value, meta: input.meta }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}