import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getBlogCategories, getBlogPosts } from "@/lib/content";
import {
  categoryUrl,
  formatPostDate,
  postReadingTime,
  postUrl,
  sortedPosts,
} from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog — Guias de websites, domínios e SEO",
  description:
    "Ideias e guias práticos sobre web design, tecnologia, SEO, marketing, domínios e alojamento para negócios em Moçambique.",
  keywords: [
    "blog",
    "web design",
    "SEO",
    "marketing digital",
    "domínios",
    "alojamento",
    "websites",
    "Moçambique",
  ],
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: {
    type: "website",
    title: "Blog — Guias de websites, domínios e SEO",
    description:
      "Ideias e guias práticos para fazer crescer a sua presença online em Moçambique.",
    url: absoluteUrl("/blog"),
    siteName: "IDesign Moz",
    locale: "pt_MZ",
    images: [{ url: absoluteUrl("/icon.png") }],
  },
  robots: { index: true, follow: true },
  twitter: {
    card: "summary",
    title: "Blog — Guias de websites, domínios e SEO",
    description:
      "Ideias e guias práticos para fazer crescer a sua presença online em Moçambique.",
    images: [absoluteUrl("/icon.png")],
  },
};

function categoryLabel(slug: string, categories: Array<{ slug: string; label: string }>): string {
  return categories.find((c) => c.slug === slug)?.label ?? slug;
}

export default async function BlogPage() {
  const [categories, allPosts] = await Promise.all([getBlogCategories(), getBlogPosts()]);
  const list = sortedPosts(allPosts);
  const [featured, ...rest] = list;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Blog IDesign Moz",
    description:
      "Ideias e guias práticos sobre web design, tecnologia, SEO, marketing, domínios e alojamento.",
    url: absoluteUrl("/blog"),
    itemListElement: list.map((post, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(postUrl(post.slug)),
      name: post.title,
    })),
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Ideias e guias
          </p>
          <h1>
            O blog do<br />
            <em>mundo digital.</em>
          </h1>
          <p>Ajuda prática para fazer crescer a sua presença online — escritos por quem constrói sites todos os dias.</p>
        </div>

        <nav className="blog-cats" aria-label="Categorias do blog">
          {categories.map((cat) => (
            <Link key={cat.slug} className="blog-cat" href={categoryUrl(cat.slug)}>
              {cat.label}
              <span>{allPosts.filter((p) => p.category === cat.slug).length}</span>
            </Link>
          ))}
        </nav>

        {featured && (
          <Link href={postUrl(featured.slug)} className="blog-featured">
            <div>
              <p className="eyebrow">
                <span className="pulse" /> Em destaque
              </p>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <span className="blog-meta">
                {formatPostDate(featured.date)} · {postReadingTime(featured.body)} min de leitura
              </span>
            </div>
            <b aria-hidden="true">↗</b>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {rest.map((post) => (
            <Link className="catalog-card" href={postUrl(post.slug)} key={post.slug}>
              <span>{categoryLabel(post.category, categories)}</span>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <b>
                Ler <span aria-hidden="true">↗</span>
              </b>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}