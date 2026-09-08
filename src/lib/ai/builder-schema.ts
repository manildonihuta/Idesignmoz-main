/* --------------------------------------------------------------------- *
 * AI Website Builder — section schema (pure module: safe on client+server)
 *
 * Single source of truth for generated site structure. The AI returns JSON
 * matching these shapes; parseSitePayload guards + normalizes it before
 * anything is persisted. The renderer and the editor both consume these
 * types so a generated site is always renderable.
 * --------------------------------------------------------------------- */

export type Cta = { label: string; href?: string };

export type HeroSection = {
  type: "hero";
  headline: string;
  subheadline?: string;
  cta?: Cta;
  align?: "left" | "center";
};

export type AboutSection = {
  type: "about";
  heading?: string;
  body: string;
  bullets?: string[];
};

export type FeaturesSection = {
  type: "features";
  heading?: string;
  intro?: string;
  items: Array<{ title: string; text: string }>;
};

export type ServicesSection = {
  type: "services";
  heading?: string;
  intro?: string;
  items: Array<{ name: string; description?: string; price_mt?: number | null }>;
};

export type GallerySection = {
  type: "gallery";
  heading?: string;
  items: Array<{ label: string; caption?: string }>;
};

export type StatsSection = {
  type: "stats";
  heading?: string;
  items: Array<{ value: string; label: string }>;
};

export type TestimonialsSection = {
  type: "testimonials";
  heading?: string;
  items: Array<{ quote: string; author: string; role?: string }>;
};

export type FaqSection = {
  type: "faq";
  heading?: string;
  items: Array<{ q: string; a: string }>;
};

export type CtaSection = {
  type: "cta";
  headline: string;
  sub?: string;
  button?: Cta;
};

export type ContactSection = {
  type: "contact";
  heading?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
};

export type FooterSection = {
  type: "footer";
  text?: string;
  links?: Cta[];
};

export type TextSection = {
  type: "text";
  heading?: string;
  body: string;
};

export type Section =
  | HeroSection
  | AboutSection
  | FeaturesSection
  | ServicesSection
  | GallerySection
  | StatsSection
  | TestimonialsSection
  | FaqSection
  | CtaSection
  | ContactSection
  | FooterSection
  | TextSection;

export const SECTION_TYPES: Section["type"][] = [
  "hero",
  "about",
  "features",
  "services",
  "gallery",
  "stats",
  "testimonials",
  "faq",
  "cta",
  "contact",
  "footer",
  "text",
];

export type Theme = {
  primaryColor?: string;
  accentColor?: string;
  mode?: "dark" | "light";
  font?: "sans" | "display" | "mono";
};

export type Seo = { title: string; description: string };

export type PagePayload = {
  slug: string;
  title: string;
  navLabel?: string;
  sections: Section[];
};

export type SitePayload = {
  name: string;
  tagline?: string;
  theme: Theme;
  seo: Seo;
  pages: PagePayload[];
};

/* ----------------------------- limits ------------------------------- */

export const LIMITS = {
  pages: 8,
  sectionsPerPage: 12,
  sectionFields: 12,
  itemsPerList: 12,
  textLength: 2000,
  sectionJsonDepth: 3,
} as const;

/* --------------------------- type guards ---------------------------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function clipString(value: unknown, max: number): string | undefined {
  return isString(value) ? value.slice(0, max) : undefined;
}

function isCta(value: unknown): value is Cta {
  return isPlainObject(value) && isString(value.label) && (value.href === undefined || isString(value.href));
}

type SectionSpec = {
  type: Section["type"];
  pick: (raw: Record<string, unknown>) => Section | null;
};

function pickItems(raw: unknown, guard: (value: unknown, index: number) => unknown): unknown[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw.slice(0, LIMITS.itemsPerList).map(guard).filter((v) => v !== undefined);
  return items.length > 0 ? items : undefined;
}

function listItem(pick: (raw: Record<string, unknown>, index: number) => unknown) {
  return (value: unknown, index: number): unknown => {
    if (!isPlainObject(value)) return undefined;
    return pick(value, index);
  };
}

const SECTION_SPECS: SectionSpec[] = [
  {
    type: "hero",
    pick: (raw) => {
      const headline = clipString(raw.headline, 200);
      if (!headline) return null;
      const section: HeroSection = {
        type: "hero",
        headline,
        subheadline: clipString(raw.subheadline, 400),
        align: raw.align === "center" ? "center" : raw.align === "left" ? "left" : undefined,
      };
      if (isCta(raw.cta)) section.cta = { label: raw.cta.label.slice(0, 60), href: raw.cta.href };
      return section;
    },
  },
  {
    type: "about",
    pick: (raw) => {
      const body = clipString(raw.body, LIMITS.textLength);
      if (!body) return null;
      const section: AboutSection = {
        type: "about",
        body,
        heading: clipString(raw.heading, 200),
      };
      if (Array.isArray(raw.bullets)) {
        section.bullets = raw.bullets
          .slice(0, LIMITS.itemsPerList)
          .filter(isString)
          .map((s) => s.slice(0, 400));
      }
      return section;
    },
  },
  {
    type: "features",
    pick: (raw) => {
      const items = pickItems(
        raw.items,
        listItem((item) =>
          isString(item.title)
            ? { title: item.title.slice(0, 160), text: clipString(item.text, 400) ?? "" }
            : undefined,
        ),
      );
      if (!items) return null;
      return { type: "features", heading: clipString(raw.heading, 200), intro: clipString(raw.intro, 400), items: items as FeaturesSection["items"] };
    },
  },
  {
    type: "services",
    pick: (raw) => {
      const items = pickItems(
        raw.items,
        listItem((item) => {
          if (!isString(item.name)) return undefined;
          const out: ServicesSection["items"][number] = {
            name: item.name.slice(0, 160),
            description: clipString(item.description, 400),
          };
          if (typeof item.price_mt === "number" && Number.isFinite(item.price_mt) && item.price_mt >= 0) {
            out.price_mt = Math.round(item.price_mt);
          }
          return out;
        }),
      );
      if (!items) return null;
      return { type: "services", heading: clipString(raw.heading, 200), intro: clipString(raw.intro, 400), items: items as ServicesSection["items"] };
    },
  },
  {
    type: "gallery",
    pick: (raw) => {
      const items = pickItems(
        raw.items,
        listItem((item) =>
          isString(item.label)
            ? { label: item.label.slice(0, 160), caption: clipString(item.caption, 400) }
            : undefined,
        ),
      );
      if (!items) return null;
      return { type: "gallery", heading: clipString(raw.heading, 200), items: items as GallerySection["items"] };
    },
  },
  {
    type: "stats",
    pick: (raw) => {
      const items = pickItems(
        raw.items,
        listItem((item) =>
          isString(item.value) && isString(item.label)
            ? { value: item.value.slice(0, 40), label: item.label.slice(0, 160) }
            : undefined,
        ),
      );
      if (!items) return null;
      return { type: "stats", heading: clipString(raw.heading, 200), items: items as StatsSection["items"] };
    },
  },
  {
    type: "testimonials",
    pick: (raw) => {
      const items = pickItems(
        raw.items,
        listItem((item) =>
          isString(item.quote) && isString(item.author)
            ? { quote: item.quote.slice(0, 1000), author: item.author.slice(0, 120), role: clipString(item.role, 160) }
            : undefined,
        ),
      );
      if (!items) return null;
      return { type: "testimonials", heading: clipString(raw.heading, 200), items: items as TestimonialsSection["items"] };
    },
  },
  {
    type: "faq",
    pick: (raw) => {
      const items = pickItems(
        raw.items,
        listItem((item) =>
          isString(item.q) && isString(item.a)
            ? { q: item.q.slice(0, 300), a: item.a.slice(0, 1000) }
            : undefined,
        ),
      );
      if (!items) return null;
      return { type: "faq", heading: clipString(raw.heading, 200), items: items as FaqSection["items"] };
    },
  },
  {
    type: "cta",
    pick: (raw) => {
      const headline = clipString(raw.headline, 200);
      if (!headline) return null;
      const section: CtaSection = { type: "cta", headline, sub: clipString(raw.sub, 400) };
      if (isCta(raw.button)) section.button = { label: raw.button.label.slice(0, 60), href: raw.button.href };
      return section;
    },
  },
  {
    type: "contact",
    pick: (raw) => {
      const section: ContactSection = {
        type: "contact",
        heading: clipString(raw.heading, 200),
        email: clipString(raw.email, 200),
        phone: clipString(raw.phone, 60),
        address: clipString(raw.address, 300),
        note: clipString(raw.note, 500),
      };
      return section;
    },
  },
  {
    type: "footer",
    pick: (raw) => {
      const section: FooterSection = { type: "footer", text: clipString(raw.text, 400) };
      if (Array.isArray(raw.links)) {
        const links = raw.links.slice(0, LIMITS.itemsPerList).filter(isCta) as Cta[];
        if (links.length > 0) section.links = links;
      }
      return section;
    },
  },
  {
    type: "text",
    pick: (raw) => {
      const body = clipString(raw.body, LIMITS.textLength);
      if (!body) return null;
      return { type: "text", heading: clipString(raw.heading, 200), body };
    },
  },
];

function parseSection(value: unknown): Section | null {
  if (!isPlainObject(value)) return null;
  const spec = SECTION_SPECS.find((s) => s.type === value.type);
  if (!spec) return null;
  return spec.pick(value);
}

/** Adds a stable `id` (for editor keys) and clips depth. */
function normalizeSection(section: Section, index: number): Section & { id: string } {
  return { ...section, id: `sec-${index + 1}` };
}

function parsePages(root: Record<string, unknown>): PagePayload[] | null {
  const rawPages = Array.isArray(root.pages) ? root.pages : null;
  if (!rawPages) return null;
  const pages: PagePayload[] = [];
  const seenSlugs = new Set<string>();
  for (const rawPage of rawPages.slice(0, LIMITS.pages)) {
    if (!isPlainObject(rawPage)) continue;
    const slug = isString(rawPage.slug) ? rawPage.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) : "";
    const title = isString(rawPage.title) ? rawPage.title.slice(0, 200) : "";
    if (!slug || !title || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const sections: Array<Section & { id: string }> = [];
    if (Array.isArray(rawPage.sections)) {
      for (const rawSection of rawPage.sections.slice(0, LIMITS.sectionsPerPage)) {
        const section = parseSection(rawSection);
        if (section) sections.push(normalizeSection(section, sections.length));
      }
    }
    if (sections.length === 0) continue;
    pages.push({ slug, title, navLabel: clipString(rawPage.navLabel, 60), sections });
  }
  return pages.length > 0 ? pages : null;
}

export type ParseResult =
  | { ok: true; site: SitePayload }
  | { ok: false; error: string };

/** Guards + normalizes the AI JSON into a renderable SitePayload. */
export function parseSitePayload(raw: unknown): ParseResult {
  if (!isPlainObject(raw)) return { ok: false, error: "A resposta do site não é um objeto JSON." };
  const name = isString(raw.name) ? raw.name.slice(0, 160) : "";
  if (!name) return { ok: false, error: "Falta o nome do site." };
  const seo = isPlainObject(raw.seo) ? raw.seo : {};
  const seoTitle = isString(seo.title) ? seo.title.slice(0, 120) : "";
  const themeValue = isPlainObject(raw.theme) ? raw.theme : {};
  const theme: Theme = {
    primaryColor: isString(themeValue.primaryColor) && /^#[0-9a-fA-F]{3,8}$/.test(themeValue.primaryColor) ? themeValue.primaryColor : undefined,
    accentColor: isString(themeValue.accentColor) && /^#[0-9a-fA-F]{3,8}$/.test(themeValue.accentColor) ? themeValue.accentColor : undefined,
    mode: themeValue.mode === "dark" || themeValue.mode === "light" ? themeValue.mode : undefined,
    font: themeValue.font === "sans" || themeValue.font === "display" || themeValue.font === "mono" ? themeValue.font : undefined,
  };
  const pages = parsePages(raw);
  if (!pages) return { ok: false, error: "O site não tem páginas com secções válidas." };
  if (pages[0].slug !== "inicio") {
    return { ok: false, error: "A primeira página do site deve ser 'inicio'." };
  }
  return {
    ok: true,
    site: {
      name,
      tagline: isString(raw.tagline) ? raw.tagline.slice(0, 300) : undefined,
      theme,
      seo: { title: seoTitle, description: isString(seo.description) ? seo.description.slice(0, 300) : "" },
      pages,
    },
  };
}

export type ParsedSection = Section & { id: string };

/** Guards + normalizes a single rewritten/edited section. */
export function parseSectionPayload(raw: unknown): { ok: true; section: ParsedSection } | { ok: false; error: string } {
  const section = parseSection(raw);
  if (!section) return { ok: false, error: "Secção inválida." };
  return { ok: true, section: normalizeSection(section, 0) };
}

/** Validates + normalizes a client-edited section list (editor save). */
export function parseSectionsInput(value: unknown): { ok: true; sections: ParsedSection[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "Secções inválidas." };
  const sections: ParsedSection[] = [];
  for (const raw of value.slice(0, LIMITS.sectionsPerPage)) {
    const section = parseSection(raw);
    if (!section) return { ok: false, error: "Existe uma secção desconhecida na página." };
    sections.push(normalizeSection(section, sections.length));
  }
  if (sections.length === 0) return { ok: false, error: "A página não pode ficar sem secções." };
  return { ok: true, sections };
}