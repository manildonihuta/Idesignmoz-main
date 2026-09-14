import Link from "next/link";
import type { ReactNode } from "react";

import type { ParsedSection, Theme } from "@/lib/ai/builder-schema";

const PRIMARY_FALLBACK = "#c8ff4d";

export type RenderableSite = {
  id: string;
  businessName: string;
  name?: string;
  tagline: string;
  theme: Theme;
};

export type RenderablePage = {
  id: string;
  slug: string;
  title: string;
  navLabel: string | null;
  sections: ParsedSection[];
};

function primaryOf(theme: Theme): string {
  return theme.primaryColor ?? PRIMARY_FALLBACK;
}

function SectionShell({ section, children }: { section: ParsedSection; children: ReactNode }) {
  const isDark = section.type === "footer" || section.type === "cta";
  return (
    <section
      className={`px-6 py-14 md:px-10 ${
        isDark
          ? "border-t border-black/10 dark:border-white/10"
          : "border-t border-black/5 dark:border-white/5"
      }`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">{children}</div>
    </section>
  );
}

function SectionHeading({ title, light }: { title: string; light?: boolean }) {
  return (
    <h2
      className={`mb-2 max-w-2xl text-3xl font-semibold tracking-tighter md:text-4xl ${
        light ? "text-zinc-100" : "text-zinc-900 dark:text-zinc-100"
      }`}
    >
      {title}
    </h2>
  );
}

function CtaButton({ label, href, primary }: { label: string; href?: string; primary: string }) {
  const className = "inline-flex rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90";
  if (href) {
    return (
      <Link className={className} style={{ backgroundColor: primary, color: "#0b0f0a" }} href={href}>
        {label} ↗
      </Link>
    );
  }
  return (
    <span className={className} style={{ backgroundColor: primary, color: "#0b0f0a" }}>
      {label}
    </span>
  );
}

export function renderSection(section: ParsedSection, theme: Theme) {
  const primary = primaryOf(theme);

  switch (section.type) {
    case "hero":
      return (
        <section className="flex min-h-[70vh] flex-col justify-center px-6 py-20 md:px-10">
          <div
            className={`mx-auto flex w-full max-w-5xl flex-col gap-10 ${
              section.image ? "md:grid md:grid-cols-2 md:items-center" : ""
            }`}
          >
            <div className={`${section.align === "center" ? "items-center text-center" : "items-start text-left"} flex flex-col gap-6`}>
              <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: primary }}>
                {section.subheadline && <span>{section.subheadline}</span>}
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tighter text-zinc-900 dark:text-zinc-100 md:text-7xl">
                {section.headline}
              </h1>
              {section.cta ? <CtaButton label={section.cta.label} href={section.cta.href} primary={primary} /> : null}
            </div>
            {section.image ? (
              <img
                className="aspect-[4/3] w-full rounded-2xl border border-black/10 object-cover dark:border-white/10"
                src={section.image}
                alt=""
                loading="lazy"
              />
            ) : null}
          </div>
        </section>
      );

    case "about":
      return (
        <SectionShell section={section}>
          <div className={section.image ? "grid gap-8 md:grid-cols-2 md:items-center" : ""}>
            <div>
              {section.heading ? <SectionHeading title={section.heading} /> : null}
              <p className="max-w-3xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">{section.body}</p>
              {section.bullets?.length ? (
                <ul className="grid max-w-3xl gap-3 md:grid-cols-2">
                  {section.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-zinc-700 dark:text-zinc-300">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primary }} />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {section.image ? (
              <img className="aspect-[4/3] w-full rounded-2xl border border-black/10 object-cover dark:border-white/10" src={section.image} alt="" loading="lazy" />
            ) : null}
          </div>
        </SectionShell>
      );

    case "features":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          {section.intro ? <p className="max-w-2xl text-zinc-600 dark:text-zinc-300">{section.intro}</p> : null}
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            {section.items.map((item, i) => (
              <div key={i} className="rounded-2xl border border-black/10 p-6 dark:border-white/10">
                <span className="text-2xl font-bold" style={{ color: primary }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                {item.text ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{item.text}</p> : null}
              </div>
            ))}
          </div>
        </SectionShell>
      );

    case "services":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          {section.intro ? <p className="max-w-2xl text-zinc-600 dark:text-zinc-300">{section.intro}</p> : null}
          <div className="mt-2 flex flex-col">
            {section.items.map((item, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 py-5 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-4">
                  {item.image ? (
                    <img className="h-14 w-20 rounded-lg border border-black/10 object-cover dark:border-white/10" src={item.image} alt="" loading="lazy" />
                  ) : null}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                    {item.description ? <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p> : null}
                  </div>
                </div>
                {item.price_mt != null ? (
                  <span className="text-sm font-bold" style={{ color: primary }}>
                    {item.price_mt.toLocaleString("pt-MZ")} MT
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </SectionShell>
      );

    case "gallery":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
            {section.items.map((item, i) => (
              <div
                key={i}
                className="relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl border border-black/10 p-5 dark:border-white/10"
              >
                {item.image ? (
                  <>
                    <img className="absolute inset-0 h-full w-full object-cover" src={item.image} alt="" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  </>
                ) : null}
                <div className="relative">
                  <p className={`text-lg font-semibold ${item.image ? "text-white" : "text-zinc-900 dark:text-zinc-100"}`}>{item.label}</p>
                  {item.caption ? (
                    <p className={`mt-1 text-sm ${item.image ? "text-white/80" : "text-zinc-600 dark:text-zinc-300"}`}>{item.caption}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      );

    case "stats":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <div className="mt-2 grid grid-cols-2 gap-4 md:grid-cols-4">
            {section.items.map((item, i) => (
              <div key={i} className="rounded-2xl border border-black/10 p-6 text-center dark:border-white/10">
                <p className="text-4xl font-bold tracking-tighter" style={{ color: primary }}>
                  {item.value}
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{item.label}</p>
              </div>
            ))}
          </div>
        </SectionShell>
      );

    case "testimonials":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            {section.items.map((item, i) => (
              <figure key={i} className="rounded-2xl border border-black/10 p-6 dark:border-white/10">
                <blockquote className="text-zinc-700 dark:text-zinc-200">“{item.quote}”</blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {item.author}
                  {item.role ? <span className="ml-2 font-normal text-zinc-500">· {item.role}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </SectionShell>
      );

    case "faq":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <div className="mt-2 flex max-w-3xl flex-col">
            {section.items.map((item, i) => (
              <details key={i} className="border-b border-black/10 py-4 dark:border-white/10" open={i === 0}>
                <summary className="cursor-pointer list-none text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {item.q}
                </summary>
                <p className="mt-2 pb-2 text-zinc-600 dark:text-zinc-300">{item.a}</p>
              </details>
            ))}
          </div>
        </SectionShell>
      );

    case "cta":
      return (
        <section className="px-6 py-20 md:px-10">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 rounded-3xl border border-black/10 p-8 dark:border-white/10">
            <div>
              <h2 className="max-w-xl text-3xl font-semibold tracking-tighter text-zinc-900 dark:text-zinc-100 md:text-4xl">
                {section.headline}
              </h2>
              {section.sub ? <p className="mt-2 text-zinc-600 dark:text-zinc-300">{section.sub}</p> : null}
            </div>
            {section.button ? <CtaButton label={section.button.label} href={section.button.href} primary={primary} /> : null}
          </div>
        </section>
      );

    case "contact":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <div className="mt-2 grid max-w-3xl gap-6 md:grid-cols-2">
            {(section.email || section.phone) && (
              <div className="flex flex-col gap-2 text-zinc-700 dark:text-zinc-300">
                {section.email ? (
                  <span>
                    <b className="font-semibold text-zinc-900 dark:text-zinc-100">Email:</b>{" "}
                    <a className="underline" style={{ color: primary }} href={`mailto:${section.email}`}>
                      {section.email}
                    </a>
                  </span>
                ) : null}
                {section.phone ? (
                  <span>
                    <b className="font-semibold text-zinc-900 dark:text-zinc-100">Telemóvel:</b> {section.phone}
                  </span>
                ) : null}
                {section.address ? (
                  <span>
                    <b className="font-semibold text-zinc-900 dark:text-zinc-100">Morada:</b> {section.address}
                  </span>
                ) : null}
              </div>
            )}
            {section.email || section.phone ? (
              <a
                className="inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                style={{ backgroundColor: primary, color: "#0b0f0a" }}
                href={section.email ? `mailto:${section.email}` : `tel:${section.phone}`}
              >
                {section.email ? `Contactar ${section.email}` : "Contactar"}
              </a>
            ) : null}
            {section.note ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{section.note}</p> : null}
          </div>
        </SectionShell>
      );

    case "footer":
      return (
        <footer className="border-t border-black/10 px-6 py-12 dark:border-white/10">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            {section.text ? <p>{section.text}</p> : null}
            {section.links?.length ? (
              <div className="flex flex-wrap gap-4">
                {section.links.map((link, i) =>
                  link.href ? (
                    <Link key={i} className="underline" href={link.href}>
                      {link.label}
                    </Link>
                  ) : (
                    <span key={i}>{link.label}</span>
                  ),
                )}
              </div>
            ) : null}
          </div>
        </footer>
      );

    case "text":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <p className="max-w-3xl whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">{section.body}</p>
        </SectionShell>
      );

    default:
      return null;
  }
}

export function SitePage({
  site,
  pages,
  page,
}: {
  site: RenderableSite;
  pages: RenderablePage[];
  page: RenderablePage;
}) {
  const primary = primaryOf(site.theme);
  const light = site.theme.mode === "light";

  return (
    <div
      className={light ? "bg-white text-zinc-900" : "bg-[#0d0f0d] text-zinc-100"}
      style={light ? undefined : { backgroundColor: "#0d0f0d" }}
    >
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 md:px-10">
          <span className="text-lg font-bold tracking-tighter">
            {site.businessName}
            {site.theme.primaryColor ? (
              <span style={{ color: primary }}>.</span>
            ) : null}
          </span>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            {pages.map((p) => (
              <Link
                key={p.id}
                className={p.id === page.id ? "font-bold" : "opacity-80"}
                style={p.id === page.id ? { color: primary } : undefined}
                href={`/s/${site.id}/${p.slug}`}
              >
                {p.navLabel ?? p.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>{page.sections.map((section) => <div key={section.id}>{renderSection(section, site.theme)}</div>)}</main>
      <footer className="border-t border-black/5 px-6 py-10 dark:border-white/5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {site.businessName}
          </span>
          {site.tagline ? <span>{site.tagline}</span> : null}
        </div>
      </footer>
    </div>
  );
}