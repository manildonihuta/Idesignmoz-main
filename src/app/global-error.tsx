"use client";

import { useEffect } from "react";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    try {
      console.error("[idesign:global-error]", error);
    } catch {
      /* noop */
    }
  }, [error]);

  return (
    <html lang="pt-MZ" data-theme="dark">
      <head>
        <title>Algo correu mal — IDesign Moz</title>
        <style>{`
          :root { --ink:#000000; --paper:#f2f0eb; --muted:#96938c; --line:#2b2c2b; --brand:#e60023; --surface:#11110f; }
          * { box-sizing: border-box; }
          html, body { margin: 0; height: 100%; }
          body { background: var(--surface); color: var(--paper); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; display: grid; place-items: center; }
          .panel { max-width: 26rem; width: 100%; margin: 0 1.5rem; text-align: center; }
          .kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: var(--brand); text-transform: uppercase; }
          h1 { font-size: 30px; line-height: 1.15; margin: 14px 0 0; letter-spacing: -0.02em; }
          p  { margin: 14px 0 0; font-size: 14px; line-height: 1.6; color: var(--muted); }
          .row { margin-top: 32px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
          .btn { border: 0; border-radius: 999px; padding: 11px 22px; font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; background: var(--brand); color: #fff; }
          .btn:hover { opacity: 0.9; }
          .ghost { border: 1px solid var(--line); border-radius: 999px; padding: 10px 22px; font-size: 14px; font-weight: 600; color: var(--paper); text-decoration: none; background: transparent; }
          .ghost:hover { border-color: var(--brand); }
        `}</style>
      </head>
      <body>
        <div className="panel" role="alert">
          <p className="kicker">Something went wrong.</p>
          <h1>We couldn&apos;t complete your request.</h1>
          <p>Please try again.</p>
          <div className="row">
            <button type="button" className="btn" onClick={retry}>
              Try again
            </button>
            {/* global-error has no router context; a hard navigation is intentional */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="ghost" href="/">
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}