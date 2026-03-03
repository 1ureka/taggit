/**
 * @file db-query.ts
 * Pure read-only query functions for the image database.
 *
 * Every function accepts a {@link JSONDatabase} instance as its first argument
 * so it can be used independently of the module-level singleton, making
 * testing and alternative DB instances straightforward.
 */

import type { JSONDatabase } from "./db.js";
import type { ImageRecord, ImageWithId, QueryOptions, QueryResult, TagInfo } from "$lib/types.js";

// ─── Single-record access ───────────────────────────────────────────────────

/**
 * Returns the image record with its id attached, or `null` if not found.
 *
 * @param jsonDB - The database instance to query.
 * @param id - The unique image identifier.
 */
export function getImage(jsonDB: JSONDatabase, id: string): ImageWithId | null {
  const rec = jsonDB.data.images[id];
  return rec ? { id, ...rec } : null;
}

/**
 * Returns `true` if the database contains a record for the given id.
 *
 * @param jsonDB - The database instance to query.
 * @param id - The unique image identifier.
 */
export function hasImage(jsonDB: JSONDatabase, id: string): boolean {
  return id in jsonDB.data.images;
}

/**
 * Returns all `[id, record]` pairs from the database.
 * Useful for routes that need to iterate over every image (e.g. find-missing).
 *
 * @param jsonDB - The database instance to query.
 */
export function allImageEntries(jsonDB: JSONDatabase): [string, ImageRecord][] {
  return Object.entries(jsonDB.data.images);
}

// ─── Query ──────────────────────────────────────────────────────────────────

/**
 * Unified image query — filters, sort, and optional pagination.
 *
 * - If `opts.limit` is greater than 0, results are paginated and `page`/`pages` are populated.
 * - If `opts.limit` is 0 or omitted, ALL matching items are returned (`page=1`, `pages=1`).
 *
 * @param jsonDB - The database instance to query.
 * @param opts - Optional query parameters (tags, rating, sort, order, page, limit).
 */
export function queryImages(jsonDB: JSONDatabase, opts: QueryOptions = {}): QueryResult {
  const tags = opts.tags ?? [];
  const rating = opts.rating;
  const ratingOp = opts.ratingOp ?? "gte";
  const sort = opts.sort ?? "committedAt";
  const order = opts.order ?? "desc";
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;
  const page = Math.max(1, opts.page ?? 1);

  const ids = filterIds(jsonDB, tags, rating, ratingOp);

  // Build sorted item list
  let items: ImageWithId[] = [...ids].map((id) => ({ id, ...jsonDB.data.images[id] }));

  if (sort === "random") {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  } else {
    items.sort((a, b) => {
      const va =
        sort === "rating"
          ? (a.rating ?? 0)
          : sort === "originalName"
            ? (a.originalName ?? "").toLowerCase()
            : (a.committedAt ?? 0);
      const vb =
        sort === "rating"
          ? (b.rating ?? 0)
          : sort === "originalName"
            ? (b.originalName ?? "").toLowerCase()
            : (b.committedAt ?? 0);
      if (va < vb) return order === "asc" ? -1 : 1;
      if (va > vb) return order === "asc" ? 1 : -1;
      return 0;
    });
  }

  const total = items.length;

  if (limit > 0) {
    const pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    items = items.slice(start, start + limit);
    return { items, total, page, pages };
  }

  return { items, total, page: 1, pages: 1 };
}

/**
 * Applies tag and rating filters, returning a set of matching image ids.
 *
 * - Tags are intersected (AND semantics).
 * - Rating is compared using the given operator (`gte`, `lte`, or `eq`).
 *
 * @param jsonDB - The database instance to query.
 * @param tags - Tags that every returned image must have.
 * @param rating - Rating threshold (or exact value) to filter by.
 * @param ratingOp - Comparison operator for the rating filter.
 */
export function filterIds(
  jsonDB: JSONDatabase,
  tags: string[],
  rating: number | undefined,
  ratingOp: "gte" | "lte" | "eq",
): Set<string> {
  let ids: Set<string>;

  if (tags.length > 0) {
    const tagSets = tags.map((t) => jsonDB.tagIndex.get(t) ?? new Set<string>());
    if (tagSets.some((ts) => ts.size === 0)) return new Set();
    ids = new Set(tagSets[0]);
    for (let i = 1; i < tagSets.length; i++) {
      for (const id of ids) {
        if (!tagSets[i].has(id)) ids.delete(id);
      }
    }
  } else {
    ids = new Set(Object.keys(jsonDB.data.images));
  }

  if (rating !== undefined) {
    for (const id of ids) {
      const r = jsonDB.data.images[id].rating ?? 0;
      const keep = ratingOp === "gte" ? r >= rating : ratingOp === "lte" ? r <= rating : r === rating;
      if (!keep) ids.delete(id);
    }
  }

  return ids;
}

// ─── Tags ───────────────────────────────────────────────────────────────────

/**
 * Returns all known tags sorted descending by their image count.
 *
 * @param jsonDB - The database instance to query.
 */
export function getAllTags(jsonDB: JSONDatabase): TagInfo[] {
  const result: TagInfo[] = [];
  for (const [name, ids] of jsonDB.tagIndex) {
    result.push({ name, count: ids.size });
  }
  return result.sort((a, b) => b.count - a.count);
}

// ─── Stats ──────────────────────────────────────────────────────────────────

/**
 * Returns the total number of committed image records in the database.
 *
 * @param jsonDB - The database instance to query.
 */
export function getImageCount(jsonDB: JSONDatabase): number {
  return Object.keys(jsonDB.data.images).length;
}

/**
 * Returns the number of distinct tags currently in use.
 *
 * @param jsonDB - The database instance to query.
 */
export function getTagCount(jsonDB: JSONDatabase): number {
  return jsonDB.tagIndex.size;
}
