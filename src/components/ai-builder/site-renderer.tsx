import Link from "next/link";
import type { ReactNode } from "react";

import type { ParsedSection, Theme } from "@/lib/ai/builder-schema";
import ThreeDTestimonials from "@/components/ui/3d-testimonails";

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

function getFontClass(font?: string) {
  if (font === "display") return "font-serif tracking-normal";
  if (font === "mono") return "font-mono tracking-tight";
  return "font-sans tracking-normal";
}

function SectionShell({ section, children }: { section: ParsedSection; children: ReactNode }) {
  const isDark = section.type === "footer" || section.type === "cta";
  return (
    <section
      className={`px-6 py-14 transition-all duration-300 md:px-10 ${
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
      className={`mb-2 max-w-2xl text-3xl font-semibold tracking-tighter transition-all duration-200 md:text-4xl ${
        light ? "text-zinc-100" : "text-zinc-900 dark:text-zinc-100"
      }`}
    >
      {title}
    </h2>
  );
}

function CtaButton({ label, href, primary }: { label: string; href?: string; primary: string }) {
  const className = "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-md transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]";
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
              {section.subheadline && (
                <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: primary }}>
                  {section.subheadline}
                </p>
              )}
              <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tighter text-zinc-900 dark:text-zinc-100 md:text-7xl">
                {section.headline}
              </h1>
              {section.cta ? <CtaButton label={section.cta.label} href={section.cta.href} primary={primary} /> : null}
            </div>
            {section.image ? (
              <div className="group overflow-hidden rounded-2xl border border-black/10 shadow-lg transition-transform duration-300 hover:scale-[1.01] dark:border-white/10">
                <img
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src={section.image}
                  alt=""
                  loading="lazy"
                />
              </div>
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
                <ul className="mt-4 grid max-w-3xl gap-3 md:grid-cols-2">
                  {section.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-zinc-700 dark:text-zinc-300">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: primary }} />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {section.image ? (
              <div className="group overflow-hidden rounded-2xl border border-black/10 shadow-md transition-transform duration-300 hover:scale-[1.01] dark:border-white/10">
                <img className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" src={section.image} alt="" loading="lazy" />
              </div>
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
              <div key={i} className="group rounded-2xl border border-black/10 p-6 transition-all duration-300 hover:border-black/30 hover:shadow-md dark:border-white/10 dark:hover:border-white/30">
                <span className="text-2xl font-bold transition-transform duration-200 group-hover:scale-110 inline-block" style={{ color: primary }}>
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
              <div key={i} className="group flex flex-wrap items-center justify-between gap-3 border-b border-black/10 py-5 transition-colors duration-200 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.02] px-2 rounded-lg">
                <div className="flex flex-wrap items-center gap-4">
                  {item.image ? (
                    <img className="h-14 w-20 rounded-lg border border-black/10 object-cover transition-transform duration-300 group-hover:scale-105 dark:border-white/10" src={item.image} alt="" loading="lazy" />
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
                className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl border border-black/10 p-5 transition-transform duration-300 hover:scale-[1.02] shadow-md dark:border-white/10"
              >
                {item.image ? (
                  <>
                    <img className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" src={item.image} alt="" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
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
              <div key={i} className="group rounded-2xl border border-black/10 p-6 text-center transition-all duration-300 hover:border-black/30 hover:shadow-md dark:border-white/10 dark:hover:border-white/30">
                <p className="text-4xl font-bold tracking-tighter transition-transform duration-200 group-hover:scale-105 inline-block" style={{ color: primary }}>
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
          <ThreeDTestimonials
            testimonials={section.items.map((item) => ({
              name: item.author,
              role: item.role,
              body: item.quote,
            }))}
          />
        </SectionShell>
      );

    case "faq":
      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <div className="mt-2 flex max-w-3xl flex-col">
            {section.items.map((item, i) => (
              <details key={i} className="border-b border-black/10 py-4 transition-colors duration-200 dark:border-white/10" open={i === 0}>
                <summary className="cursor-pointer list-none text-lg font-semibold text-zinc-900 hover:opacity-80 dark:text-zinc-100">
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
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 rounded-3xl border border-black/10 p-8 shadow-xl transition-all duration-300 hover:shadow-2xl dark:border-white/10 md:flex-row md:items-center">
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
      const cleanPhone = section.phone ? section.phone.replace(/[^0-9]/g, "") : "";
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith("258") ? cleanPhone : `258${cleanPhone}`}` : null;

      return (
        <SectionShell section={section}>
          {section.heading ? <SectionHeading title={section.heading} /> : null}
          <div className="mt-2 grid max-w-3xl gap-6 md:grid-cols-2">
            {(section.email || section.phone || section.address) && (
              <div className="flex flex-col gap-3 text-zinc-700 dark:text-zinc-300">
                {section.email ? (
                  <span className="flex items-center gap-2">
                    <b className="font-semibold text-zinc-900 dark:text-zinc-100">Email:</b>{" "}
                    <a className="underline" style={{ color: primary }} href={`mailto:${section.email}`}>
                      {section.email}
                    </a>
                  </span>
                ) : null}
                {section.phone ? (
                  <span className="flex items-center gap-2">
                    <b className="font-semibold text-zinc-900 dark:text-zinc-100">Telemóvel:</b> {section.phone}
                  </span>
                ) : null}
                {section.address ? (
                  <span className="flex items-center gap-2">
                    <b className="font-semibold text-zinc-900 dark:text-zinc-100">Morada:</b> {section.address}
                  </span>
                ) : null}
              </div>
            )}
            <div className="flex flex-col gap-3">
              {waUrl ? (
                <a
                  className="inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.03]"
                  style={{ backgroundColor: "#25D366" }}
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 Conversar no WhatsApp
                </a>
              ) : null}
              {section.email ? (
                <a
                  className="inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-md transition-transform hover:scale-[1.03]"
                  style={{ backgroundColor: primary, color: "#0b0f0a" }}
                  href={`mailto:${section.email}`}
                >
                  ✉️ Enviar Email
                </a>
              ) : null}
            </div>
            {section.note ? <p className="col-span-full text-sm text-zinc-500 dark:text-zinc-400">{section.note}</p> : null}
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
                    <Link key={i} className="underline hover:opacity-80" href={link.href}>
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
  const fontClass = getFontClass(site.theme.font);

  return (
    <div
      className={`${fontClass} ${light ? "bg-white text-zinc-900" : "bg-[#0d0f0d] text-zinc-100"}`}
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
                className={p.id === page.id ? "font-bold" : "opacity-80 hover:opacity-100"}
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