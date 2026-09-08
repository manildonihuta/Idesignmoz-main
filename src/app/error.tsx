"use client";

import Link from "next/link";
import { useEffect } from "react";

function reportError(error: Error & { digest?: string }) {
  try {
    console.error("[idesign:page-error]", error);
  } catch {
    /* noop */
  }
  try {
    fetch("/api/monitoring/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: window.location.href,
        digest: error.digest ?? null,
        message: error.message,
        stack: error.stack ?? null,
      }),
    }).catch(() => {
      /* noop */
    });
  } catch {
    /* noop */
  }
}

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <main id="main" className="inner-page section-wrap">
      <div className="flex min-h-screen items-center justify-center py-20">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand" aria-hidden="true">
            ● Ops
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-paper">Something went wrong.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            We couldn&apos;t complete your request.
            <br />
            Please try again.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={retry} className="button">
              Try again
            </button>
            <Link href="/" className="outline-button">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}