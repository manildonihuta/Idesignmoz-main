import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="flex min-h-[60vh] items-center justify-center py-20">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-10 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand" aria-hidden="true">
              ● 404
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-paper">Page not found.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We couldn&apos;t find the page you were looking for.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/" className="button">
                Back to home
              </Link>
              <Link href="/contact" className="outline-button">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}