/**
 * In-memory DB — pure data layer.
 *
 * All file-system operations (rename, delete, readdir etc.) are handled
 * by the route that calls these functions.  db.ts only manages:
 *   - Record CRUD (committed images only)
 *   - Tag & rating indexes
 *   - Dirty-flag + 500 ms debounce flush to db.json
 */

import fs from "fs";
import { getCollectionPaths } from "./config.js";
import type { DBData, ImageRecord, ImageWithId, QueryOptions, QueryResult, TagInfo } from "$lib/types.js";

// ─── HMR Guard ──────────────────────────────────────────────────────────────

declare global {
  var __db:
    | {
        data: DBData;
        tagIndex: Map<string, Set<string>>;
        ratingIndex: Map<number, Set<string>>;
        dirty: boolean;
        flushTimer: ReturnType<typeof setTimeout> | null;
        currentRoot: string | null;
        loaded: boolean;
      }
    | undefined;
}

function store() {
  if (!globalThis.__db) {
    globalThis.__db = {
      data: { version: 1, images: {} },
      tagIndex: new Map(),
      ratingIndex: new Map(),
      dirty: false,
      flushTimer: null,
      currentRoot: null,
      loaded: false,
    };
  }
  return globalThis.__db;
}

// ─── Index helpers ──────────────────────────────────────────────────────────

function buildIndexes(): void {
  const s = store();
  s.tagIndex.clear();
  s.ratingIndex.clear();
  for (const [id, rec] of Object.entries(s.data.images)) {
    indexAdd(id, rec, s);
  }
}

function indexAdd(id: string, rec: ImageRecord, s = store()): void {
  for (const tag of rec.tags) {
    if (!s.tagIndex.has(tag)) s.tagIndex.set(tag, new Set());
    s.tagIndex.get(tag)!.add(id);
  }
  const r = rec.rating ?? 0;
  if (!s.ratingIndex.has(r)) s.ratingIndex.set(r, new Set());
  s.ratingIndex.get(r)!.add(id);
}

function indexRemove(id: string, rec: ImageRecord, s = store()): void {
  for (const tag of rec.tags) {
    const set = s.tagIndex.get(tag);
    if (set) {
      set.delete(id);
      if (set.size === 0) s.tagIndex.delete(tag);
    }
  }
  const r = rec.rating ?? 0;
  const rSet = s.ratingIndex.get(r);
  if (rSet) {
    rSet.delete(id);
    if (rSet.size === 0) s.ratingIndex.delete(r);
  }
}

// ─── Persistence ────────────────────────────────────────────────────────────

function markDirty(): void {
  const s = store();
  s.dirty = true;
  if (s.flushTimer) clearTimeout(s.flushTimer);
  s.flushTimer = setTimeout(flush, 500);
}

export function flush(): void {
  const s = store();
  if (s.flushTimer) {
    clearTimeout(s.flushTimer);
    s.flushTimer = null;
  }
  if (!s.dirty || !s.currentRoot) return;

  const dbPath = getCollectionPaths(s.currentRoot).db;
  const tmp = dbPath + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(s.data, null, 2), "utf8");
    fs.renameSync(tmp, dbPath);
    s.dirty = false;
    console.log("[db] Flushed");
  } catch (e) {
    console.error("[db] Flush error:", (e as Error).message);
  }
}

// ─── Load / Switch ──────────────────────────────────────────────────────────

export function loadCollection(rootPath: string): void {
  const s = store();
  flush();

  s.currentRoot = rootPath;
  s.loaded = false;
  s.data = { version: 1, images: {} };

  const dbPath = getCollectionPaths(rootPath).db;
  const tmp = dbPath + ".tmp";

  // Recovery: prefer .tmp if main db is missing
  if (!fs.existsSync(dbPath) && fs.existsSync(tmp)) {
    console.log("[db] Recovering from tmp file");
    fs.renameSync(tmp, dbPath);
  }

  if (fs.existsSync(dbPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      s.data.version = parsed.version ?? 1;
      s.data.images = parsed.images ?? {};

      console.log(`[db] Loaded: ${Object.keys(s.data.images).length} images`);
    } catch (e) {
      console.error("[db] Load error, starting fresh:", (e as Error).message);
      s.data = { version: 1, images: {} };
      markDirty();
    }
  } else {
    console.log("[db] No existing db.json, starting fresh");
    markDirty();
  }

  buildIndexes();
  s.loaded = true;
}

export function isLoaded(): boolean {
  return store().loaded;
}

export function getCurrentRoot(): string | null {
  return store().currentRoot;
}

// ─── Single-record access ───────────────────────────────────────────────────

export function getImage(id: string): ImageWithId | null {
  const rec = store().data.images[id];
  return rec ? { id, ...rec } : null;
}

export function hasImage(id: string): boolean {
  return id in store().data.images;
}

/** All image entries — for routes that need to iterate (e.g. find-missing). */
export function allImageEntries(): [string, ImageRecord][] {
  return Object.entries(store().data.images);
}

// ─── Query ──────────────────────────────────────────────────────────────────

/**
 * Unified image query — filters + sort + pagination.
 *
 * - If `opts.limit` > 0 → paginated (page/pages populated).
 * - If `opts.limit` is 0 or undefined → returns ALL matching items (page=1, pages=1).
 */
export function queryImages(opts: QueryOptions = {}): QueryResult {
  const s = store();
  const tags = opts.tags ?? [];
  const rating = opts.rating;
  const ratingOp = opts.ratingOp ?? "gte";
  const sort = opts.sort ?? "committedAt";
  const order = opts.order ?? "desc";
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;
  const page = Math.max(1, opts.page ?? 1);

  const ids = filterIds(s, tags, rating, ratingOp);

  // Build & sort
  let items: ImageWithId[] = [...ids].map((id) => ({ id, ...s.data.images[id] }));

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

/** Shared tag + rating filter for queryImages. */
function filterIds(
  s: NonNullable<typeof globalThis.__db>,
  tags: string[],
  rating: number | undefined,
  ratingOp: "gte" | "lte" | "eq",
): Set<string> {
  let ids: Set<string>;

  if (tags.length > 0) {
    const tagSets = tags.map((t) => s.tagIndex.get(t) ?? new Set<string>());
    if (tagSets.some((ts) => ts.size === 0)) return new Set();
    ids = new Set(tagSets[0]);
    for (let i = 1; i < tagSets.length; i++) {
      for (const id of ids) {
        if (!tagSets[i].has(id)) ids.delete(id);
      }
    }
  } else {
    ids = new Set(Object.keys(s.data.images));
  }

  if (rating !== undefined) {
    for (const id of ids) {
      const r = s.data.images[id].rating ?? 0;
      const keep = ratingOp === "gte" ? r >= rating : ratingOp === "lte" ? r <= rating : r === rating;
      if (!keep) ids.delete(id);
    }
  }

  return ids;
}

// ─── Mutations (data only — no file I/O) ────────────────────────────────────

/** Add a new committed image record. */
export function addImage(id: string, record: ImageRecord): void {
  const s = store();
  s.data.images[id] = record;
  indexAdd(id, record, s);
  markDirty();
}

/** Remove a committed image record. Returns the removed record. */
export function removeImage(id: string): ImageRecord {
  const s = store();
  const rec = s.data.images[id];
  if (!rec) throw new Error("Image not found: " + id);
  indexRemove(id, rec, s);
  delete s.data.images[id];
  markDirty();
  return rec;
}

/** Update tags / rating with optimistic-concurrency check. */
export function updateImage(
  id: string,
  patch: { tags?: string[]; rating?: number },
  expectedUpdatedAt: number,
): ImageWithId {
  const s = store();
  const rec = s.data.images[id];
  if (!rec) throw new Error("Image not found: " + id);

  if (rec.updatedAt !== expectedUpdatedAt) {
    throw Object.assign(new Error("Conflict"), { status: 409, record: { id, ...rec } });
  }

  indexRemove(id, rec, s);
  if (patch.tags !== undefined) rec.tags = patch.tags;
  if (patch.rating !== undefined) rec.rating = patch.rating;
  rec.updatedAt = Date.now();
  indexAdd(id, rec, s);
  markDirty();

  return { id, ...rec };
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export function getAllTags(): TagInfo[] {
  const result: TagInfo[] = [];
  for (const [name, ids] of store().tagIndex) {
    result.push({ name, count: ids.size });
  }
  return result.sort((a, b) => b.count - a.count);
}

export function renameTag(oldName: string, newName: string): number {
  const s = store();
  const ids = s.tagIndex.get(oldName);
  if (!ids || ids.size === 0) return 0;

  let affected = 0;
  for (const id of ids) {
    const rec = s.data.images[id];
    if (!rec) continue;
    const idx = rec.tags.indexOf(oldName);
    if (idx !== -1) {
      rec.tags[idx] = newName;
      if (rec.tags.filter((t) => t === newName).length > 1) {
        rec.tags = [...new Set(rec.tags)];
      }
      affected++;
    }
  }

  buildIndexes();
  markDirty();
  return affected;
}

// ─── Stats (data only — no file I/O) ───────────────────────────────────────

export function getImageCount(): number {
  return Object.keys(store().data.images).length;
}

export function getTagCount(): number {
  return store().tagIndex.size;
}
