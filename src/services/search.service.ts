import "server-only";

import { searchAll, searchDomains, searchPosts, searchProjects, type SearchHit } from "@/lib/search";
import { searchQuerySchema } from "@/lib/schemas";
import type { ServiceResult } from "./result";

export type SearchInput = {
  q?: string;
  type?: string;
  limit?: number;
};

export async function search(input: SearchInput): Promise<ServiceResult<{ hits: SearchHit[] }>> {
  const parsed = searchQuerySchema.safeParse({
    q: input.q ?? "",
    type: input.type ?? "all",
    limit: input.limit ?? 10,
  });

  if (!parsed.success || parsed.data.limit < 1) {
    return { ok: true, hits: [] };
  }

  const { q, type, limit } = parsed.data;
  const trimmed = q.trim();
  if (!trimmed) {
    return { ok: true, hits: [] };
  }

  const hits =
    type === "domain"
      ? await searchDomains(trimmed, limit)
      : type === "post"
        ? await searchPosts(trimmed, limit)
        : type === "project"
          ? await searchProjects(trimmed, limit)
          : await searchAll(trimmed, limit);

  return { ok: true, hits };
}

export type { SearchHit };