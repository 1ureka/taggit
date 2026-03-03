/**
 * @file utils.ts
 * Shared utility functions usable on both the client and the server.
 *
 * - URL/query helpers: {@link parseTags}, {@link parseQueryParams}
 * - Formatting helpers: {@link formatDate}, {@link formatSize}
 * - Timing helpers: {@link debounce}, {@link throttle}
 */

import type { QueryOptions } from "$lib/types.js";

// ─── URL / Query helpers (usable on both client and server) ──────────────────

/**
 * Parses a comma-separated tags string from a URL query parameter.
 *
 * @example
 * parseTags("nature, cat , sky") // ["nature", "cat", "sky"]
 * parseTags(null)                // []
 *
 * @param raw - The raw query-parameter value, or `null` if absent.
 * @returns An array of trimmed, non-empty tag strings.
 */
export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extracts a {@link QueryOptions} object from the search parameters of a URL.
 *
 * Handles tags, rating, ratingOp, sort, order, page, and limit.
 * - `limit` stays `undefined` when absent, which causes `queryImages` to return all results.
 * - `rating` stays `undefined` when absent (no rating filter applied).
 *
 * @param url - The URL whose `searchParams` will be read.
 * @returns A fully-typed {@link QueryOptions} value ready to pass to `queryImages`.
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

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Format a Unix ms timestamp to a locale-friendly date-time string. */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

/** Format bytes to a human-readable size string (B / KB / MB / GB). */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Returns a debounced version of `fn`.
 * Only called after `ms` milliseconds of silence.
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T;
}

/**
 * Returns a throttled version of `fn`.
 * At most one call per `ms` milliseconds.
 */
export function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}
