import "server-only";

import { prisma } from "@/lib/prisma";

export type SearchHit = {
  model: "domain" | "post" | "project" | "website";
  id: string;
  title: string;
  url: string;
  snippet: string;
};

let hitsCache: Array<{ q: string; hits: SearchHit[]; at: number }> = [];

const HITS_CACHE_TTL_MS = 30_000;
const PORTUGUESE = "portuguese";

function clearHitsCache() {
  hitsCache = [];
}

const MEILISEARCH_URL = process.env.MEILISEARCH_URL;
const MEILISEARCH_KEY = process.env.MEILISEARCH_API_KEY;

async function searchMeilisearch<T>(
  domain: string,
  q: string,
  limit: number,
): Promise<T[]> {
  if (!MEILISEARCH_URL || !MEILISEARCH_KEY) {
    return [];
  }
  const res = await fetch(`${MEILISEARCH_URL.replace(/\/$/, "")}/indexes/${domain}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MEILISEARCH_KEY}`,
    },
    body: JSON.stringify({
      q,
      limit,
      attributesToRetrieve: ["id", "title", "url", "snippet"],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as { hits: T[] };
  return data.hits;
}

function cachedHits(q: string): SearchHit[] | null {
  const entry = hitsCache.find((c) => c.q === q);
  if (entry && Date.now() - entry.at < HITS_CACHE_TTL_MS) {
    return entry.hits;
  }
  return null;
}

function storeHits(q: string, hits: SearchHit[]) {
  clearHitsCache();
  hitsCache.push({ q, hits, at: Date.now() });
}

export async function searchDomains(query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const hit = cachedHits(`d:${q}`);
  if (hit) {
    return hit;
  }
  try {
    const rows = await prisma.$queryRaw<SearchHit[]>`
      SELECT
        'domain' AS model,
        d.id,
        d.name AS title,
        '/domains' AS url,
        ${""} AS snippet
      FROM "Domain" d
      WHERE to_tsvector(${PORTUGUESE}, d.name)
            @@ plainto_tsquery(${PORTUGUESE}, ${q})
      ORDER BY ts_rank(to_tsvector(${PORTUGUESE}, d.name),
                       plainto_tsquery(${PORTUGUESE}, ${q})) DESC
      LIMIT ${limit}
    `;
    const hits = rows.map((r) => ({ ...r, model: "domain" as const }));
    storeHits(`d:${q}`, hits);
    return hits;
  } catch {
    return [];
  }
}

export async function searchPosts(query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const hit = cachedHits(`p:${q}`);
  if (hit) {
    return hit;
  }
  try {
    const rows = await prisma.$queryRaw<SearchHit[]>`
      SELECT
        'post' AS model,
        p.id,
        p.title,
        '/blog/' || p.slug AS url,
        COALESCE(p.excerpt, '') AS snippet
      FROM "Post" p
      WHERE p.status = 'PUBLISHED'
        AND to_tsvector(${PORTUGUESE}, COALESCE(p.title, '') || ' ' || COALESCE(p.content, ''))
            @@ plainto_tsquery(${PORTUGUESE}, ${q})
      ORDER BY ts_rank(
                 to_tsvector(${PORTUGUESE}, COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')),
                 plainto_tsquery(${PORTUGUESE}, ${q})) DESC
      LIMIT ${limit}
    `;
    const hits = rows.map((r) => ({ ...r, model: "post" as const }));
    storeHits(`p:${q}`, hits);
    return hits;
  } catch {
    return [];
  }
}

export async function searchProjects(query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const hit = cachedHits(`pr:${q}`);
  if (hit) {
    return hit;
  }
  try {
    const rows = await prisma.$queryRaw<SearchHit[]>`
      SELECT
        'project' AS model,
        pr.id,
        pr.title,
        '/portfolio/' || pr.slug AS url,
        COALESCE(pr.description, '') AS snippet
      FROM "Project" pr
      WHERE pr."portfolioVisible" = true
        AND to_tsvector(${PORTUGUESE}, COALESCE(pr.title, '') || ' ' || COALESCE(pr.description, ''))
            @@ plainto_tsquery(${PORTUGUESE}, ${q})
      ORDER BY ts_rank(
                 to_tsvector(${PORTUGUESE}, COALESCE(pr.title, '') || ' ' || COALESCE(pr.description, '')),
                 plainto_tsquery(${PORTUGUESE}, ${q})) DESC
      LIMIT ${limit}
    `;
    const hits = rows.map((r) => ({ ...r, model: "project" as const }));
    storeHits(`pr:${q}`, hits);
    return hits;
  } catch {
    return [];
  }
}

export async function searchAll(query: string, limit = 10): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const meiliHits = await searchMeilisearch<SearchHit>(
    "idesignmoz",
    q,
    limit,
  );
  if (meiliHits.length > 0) {
    return meiliHits;
  }
  const [domains, posts, projects] = await Promise.all([
    searchDomains(q, Math.ceil(limit / 3)),
    searchPosts(q, Math.ceil(limit / 3)),
    searchProjects(q, Math.ceil(limit / 3)),
  ]);
  return [...domains, ...posts, ...projects].slice(0, limit);
}