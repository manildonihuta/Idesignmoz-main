import type { Metadata } from "next"
import { absoluteUrl } from "@/lib/site"

export const BRAND = "IDesign Moz"

export const CONTACT = {
  email: "hello@idesignmoz.com",
  phone: "+258 84 000 0000",
  city: "Maputo",
  country: "Mozambique",
  countryCode: "MZ",
  street: "Av. Julius Nyerere",
}

export const DEFAULT_KEYWORDS = [
  "web design",
  "websites",
  "alojamento web",
  "hosting",
  "domínios",
  "SEO",
  "marketing digital",
  "Moçambique",
  "Maputo",
  "e-commerce",
]

export type JsonLd = Record<string, unknown>

export type SeoOptions = {
  title: string
  description: string
  path: string
  keywords?: string[]
  noindex?: boolean
  nofollow?: boolean
  type?: "website" | "article"
  publishedTime?: string
  modifiedTime?: string
  tags?: string[]
}

export function seo(options: SeoOptions): Metadata {
  const {
    title,
    description,
    path,
    keywords = [],
    noindex = false,
    nofollow = false,
    type = "website",
    publishedTime,
    modifiedTime,
    tags,
  } = options
  const url = absoluteUrl(path)

  return {
    title,
    description,
    keywords: [...DEFAULT_KEYWORDS, ...keywords],
    alternates: { canonical: url },
    robots: { index: !noindex, follow: !nofollow },
    openGraph: {
      type,
      title,
      description,
      url,
      siteName: BRAND,
      locale: "pt_MZ",
      images: [{ url: absoluteUrl("/icon.png") }],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      ...(tags && tags.length > 0 ? { tags } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [absoluteUrl("/icon.png")],
    },
  }
}

const address = {
  "@type": "PostalAddress",
  streetAddress: CONTACT.street,
  addressLocality: CONTACT.city,
  addressCountry: CONTACT.countryCode,
}

export function organizationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: BRAND,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png") },
    image: absoluteUrl("/icon.png"),
    email: CONTACT.email,
    telephone: CONTACT.phone,
    address,
  }
}

export function webSiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: BRAND,
    url: absoluteUrl("/"),
    publisher: { "@id": absoluteUrl("/#organization") },
    inLanguage: "pt-MZ",
  }
}

export function localBusinessSchema(
  overrides?: {
    name?: string;
    email?: string;
    telephone?: string;
    street?: string;
    city?: string;
    countryCode?: string;
  },
): JsonLd {
  const contact = { ...CONTACT, ...(overrides ?? {}) };
  const address = {
    "@type": "PostalAddress",
    streetAddress: contact.street,
    addressLocality: contact.city,
    addressCountry: contact.countryCode,
  };
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": absoluteUrl("/#localbusiness"),
    name: contact.name || BRAND,
    url: absoluteUrl("/"),
    image: absoluteUrl("/icon.png"),
    email: contact.email,
    telephone: contact.telephone,
    priceRange: "MT",
    address,
    areaServed: contact.countryCode,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: contact.telephone,
      contactType: "customer service",
      areaServed: contact.countryCode,
      availableLanguage: ["pt", "en"],
    },
  }
}

export function serviceSchema(service: {
  name: string
  description: string
  url: string
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    url: service.url,
    provider: { "@id": absoluteUrl("/#organization") },
    areaServed: CONTACT.countryCode,
    serviceType: service.name,
  }
}

export function productSchema(product: {
  name: string
  description: string
  url: string
  price: number
  currency?: string
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: product.url,
    image: absoluteUrl("/icon.png"),
    brand: { "@id": absoluteUrl("/#organization") },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency ?? "MZN",
      url: product.url,
      availability: "https://schema.org/InStock",
    },
  }
}

export function faqSchema(
  items: Array<{ question: string; answer: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function itemListSchema(
  items: Array<{ name: string; url: string }>,
  meta?: { name?: string; description?: string; url?: string },
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(meta?.name ? { name: meta.name } : {}),
    ...(meta?.description ? { description: meta.description } : {}),
    ...(meta?.url ? { url: meta.url } : {}),
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  }
}