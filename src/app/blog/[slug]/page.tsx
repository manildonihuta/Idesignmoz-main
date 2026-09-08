import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getBlogCategory, getBlogPosts, getBlogCategories } from "@/lib/content";
import {
  categoryUrl,
  formatPostDate,
  postReadingTime,
  postUrl,
  sortedPosts,
} from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = (await getBlogPosts()).find((p) => p.slug === decodeURIComponent(slug));
  if (!post) {
    return {
      title: "Artigo — Blog IDesign Moz",
      robots: { index: false, follow: false },
    };
  }
  const category = await getBlogCategory(post.category);
  const url = absoluteUrl(postUrl(post.slug));
  const publishedTime = new Date(`${post.date}T12:00:00`).toISOString();
  const modifiedTime = new Date(`${post.updated ?? post.date}T12:00:00`).toISOString();

  return {
    title: `${post.title} — Blog IDesign Moz`,
    description: post.excerpt,
    keywords: [...post.tags, category?.label ?? ""].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: `${post.title} — Blog IDesign Moz`,
      description: post.excerpt,
      url,
      siteName: "IDesign Moz",
      locale: "pt_MZ",
      publishedTime,
      modifiedTime,
      authors: ["IDesign Moz"],
      tags: post.tags,
      images: [{ url: absoluteUrl("/icon.png") }],
    },
    robots: { index: true, follow: true },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} — Blog IDesign Moz`,
      description: post.excerpt,
      images: [absoluteUrl("/icon.png")],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [allPosts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const post = allPosts.find((p) => p.slug === decodeURIComponent(slug));
  if (!post) {
    notFound();
  }

  const category = await getBlogCategory(post.category);
  const categoryLabel = category?.label ?? post.category;
  const readMinutes = postReadingTime(post.body);

  const sameCategory = allPosts.filter((p) => p.slug !== post.slug && p.category === post.category);
  const sharedTags = allPosts.filter(
    (p) => p.slug !== post.slug && p.category !== post.category && p.tags.some((t) => post.tags.includes(t)),
  );
  const related = sortedPosts([...sameCategory, ...sharedTags]).slice(0, 3);
  const relatedLabel = (itemSlug: string) =>
    categories.find((c) => c.slug === itemSlug)?.label ?? itemSlug;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
          ...(category
            ? [
                {
                  "@type": "ListItem" as const,
                  position: 3,
                  name: category.label,
                  item: absoluteUrl(categoryUrl(category.slug)),
                },
              ]
            : []),
          { "@type": "ListItem", position: 4, name: post.title, item: absoluteUrl(postUrl(post.slug)) },
        ],
      },
      {
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        image: absoluteUrl("/icon.png"),
        mainEntityOfPage: absoluteUrl(postUrl(post.slug)),
        datePublished: new Date(`${post.date}T12:00:00`).toISOString(),
        dateModified: new Date(`${post.updated ?? post.date}T12:00:00`).toISOString(),
        articleSection: category?.label ?? post.category,
        keywords: post.tags.join(", "),
        articleBody: post.body.join("\n\n"),
        author: { "@type": "Organization", name: "IDesign Moz" },
        publisher: {
          "@type": "Organization",
          name: "IDesign Moz",
          logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png") },
        },
        inLanguage: "pt-MZ",
      },
    ],
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap detail-page">
        <nav className="breadcrumbs" aria-label="Localizador de páginas">
          <Link href="/">Início</Link>
          <span aria-hidden="true">/</span>
          <Link href="/blog">Blog</Link>
          <span aria-hidden="true">/</span>
          <Link href={categoryUrl(post.category)}>{categoryLabel}</Link>
        </nav>

        <div className="page-hero">
          <p className="eyebrow">
            <span className="pulse" /> {categoryLabel}
          </p>
          <h1>{post.title}</h1>
          <p className="text-muted">
            {formatPostDate(post.date)}
            {post.updated ? ` · atualizado a ${formatPostDate(post.updated)}` : ""}
            {" · "}
            {readMinutes} min de leitura
          </p>
        </div>

        <div className="detail-layout">
          <div className="detail-list">
            {post.body.map((paragraph, index) => (
              <div key={paragraph}>
                <span>0{index + 1}</span>
                <p>{paragraph}</p>
              </div>
            ))}
          </div>
          <div className="detail-aside">
            <p>{post.excerpt}</p>
            <p className="text-link">
              <Link href={categoryUrl(post.category)}>Mais artigos de {categoryLabel} <span aria-hidden="true">↗</span></Link>
            </p>
            <Link className="button" href="/blog">
              Voltar ao blog <span aria-hidden="true">↗</span>
            </Link>
            <div className="blog-tags">
              {post.tags.map((tag) => (
                <span className="blog-tag" key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <>
            <h2 className="related-title">Leia também</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {related.map((item) => (
                <Link className="catalog-card" href={postUrl(item.slug)} key={item.slug}>
                  <span>{relatedLabel(item.category)}</span>
                  <h2>{item.title}</h2>
                  <p>{item.excerpt}</p>
                  <b>
                    Ler <span aria-hidden="true">↗</span>
                  </b>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}