import type { ListOptions } from "$lib/types.js";

/** Parse comma-separated tags query param: "a, b, c" → ["a", "b", "c"] */
export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse all image-list query params from a URL */
export function parseListParams(url: URL): ListOptions {
  const p = url.searchParams;
  return {
    tags: parseTags(p.get("tags")),
    rating: p.has("rating") ? Number(p.get("rating")) : undefined,
    ratingOp: (p.get("ratingOp") as "gte" | "lte" | "eq") ?? "gte",
    sort: (p.get("sort") as "committedAt" | "rating" | "originalName") ?? "committedAt",
    order: (p.get("order") as "asc" | "desc") ?? "desc",
    page: p.has("page") ? Number(p.get("page")) : 1,
    limit: p.has("limit") ? Number(p.get("limit")) : 50,
  };
}

/** Parse filter-only params (no pagination/sort) — used by random-pair */
export function parseFilterParams(url: URL) {
  const p = url.searchParams;
  return {
    tags: parseTags(p.get("tags")),
    rating: p.has("rating") ? Number(p.get("rating")) : undefined,
    ratingOp: (p.get("ratingOp") as "gte" | "lte" | "eq") ?? "gte",
  };
}
