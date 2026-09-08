import Link from "next/link";
import { notFound } from "next/navigation";
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

export async function generateStaticParams() {
  const categories = await getBlogCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getBlogCategories()).find((c) => c.slug === decodeURIComponent(slug));
  if (!category) return {};
  const title = `${category.label} — Blog IDesign Moz`;
  return {
    title,
    description: category.description,
    keywords: [category.label, "blog", "IDesign Moz"],
    alternates: { canonical: absoluteUrl(categoryUrl(category.slug)) },
    openGraph: {
      type: "website",
      title,
      description: category.description,
      url: absoluteUrl(categoryUrl(category.slug)),
      siteName: "IDesign Moz",
      locale: "pt_MZ",
      images: [{ url: absoluteUrl("/icon.png") }],
    },
    robots: { index: true, follow: true },
    twitter: {
      card: "summary",
      title,
      description: category.description,
      images: [absoluteUrl("/icon.png")],
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [categories, allPosts] = await Promise.all([getBlogCategories(), getBlogPosts()]);
  const category = categories.find((c) => c.slug === decodeURIComponent(slug));
  if (!category) notFound();

  const list = sortedPosts(allPosts.filter((p) => p.category === category.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.label} — Blog IDesign Moz`,
    description: category.description,
    url: absoluteUrl(categoryUrl(category.slug)),
    isPartOf: { "@type": "Blog", name: "Blog IDesign Moz", url: absoluteUrl("/blog") },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: list.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(postUrl(post.slug)),
        name: post.title,
      })),
    },
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap">
        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> Categoria
          </p>
          <h1>
            {category.label}
          </h1>
          <p>{category.description}</p>
        </div>

        <nav className="blog-cats" aria-label="Categorias do blog">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              className={`blog-cat${cat.slug === category.slug ? " blog-cat-active" : ""}`}
              href={categoryUrl(cat.slug)}
            >
              {cat.label}
              <span>{allPosts.filter((p) => p.category === cat.slug).length}</span>
            </Link>
          ))}
        </nav>

        {list.length === 0 ? (
          <p className="text-muted">Ainda não há artigos nesta categoria. Volta em breve.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {list.map((post) => (
              <Link className="catalog-card" href={postUrl(post.slug)} key={post.slug}>
                <span>{category.label}</span>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
                <b>
                  {formatPostDate(post.date)} · {postReadingTime(post.body)} min <span aria-hidden="true">↗</span>
                </b>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-10">
          <Link className="text-link" href="/blog">
            Todos os artigos <span aria-hidden="true">↗</span>
          </Link>
        </p>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}