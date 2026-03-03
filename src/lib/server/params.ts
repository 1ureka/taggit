import type { QueryOptions } from "$lib/types.js";

/** Parse comma-separated tags query param: "a, b, c" → ["a", "b", "c"] */
export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Unified query parameter parser.
 * Extracts tags, rating, ratingOp, sort, order, page, limit from URL search params.
 *
 * - If `limit` is not present in the URL, it stays `undefined` → queryImages returns all.
 * - If `limit` is present, it is parsed as a number (caller decides the cap).
 */
export function parseQueryParams(url: URL): QueryOptions {
  const p = url.searchParams;
  return {
    tags: parseTags(p.get("tags")),
    rating: p.has("rating") ? Number(p.get("rating")) : undefined,
    ratingOp: (p.get("ratingOp") as "gte" | "lte" | "eq") ?? "gte",
    sort: (p.get("sort") as "committedAt" | "rating" | "originalName" | "random") ?? "committedAt",
    order: (p.get("order") as "asc" | "desc") ?? "desc",
    page: p.has("page") ? Number(p.get("page")) : undefined,
    limit: p.has("limit") ? Number(p.get("limit")) : undefined,
  };
}
