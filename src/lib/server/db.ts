import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getCollectionPaths, IMG_EXTS } from "./config.js";
import type {
  DBData,
  ImageRecord,
  TrashedImageRecord,
  ImageWithId,
  TrashedImageWithId,
  ListOptions,
  ListResult,
  TagInfo,
  Stats,
} from "$lib/types.js";

// ─── HMR Guard ────────────────────────────────────────────────────────────────
// Prevents hot-reload from re-initialising the in-memory state in dev mode.

declare global {
  // eslint-disable-next-line no-var
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

function getStore() {
  if (!globalThis.__db) {
    globalThis.__db = {
      data: { version: 1, images: {}, trashedImages: {} },
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

// ─── Index Helpers ────────────────────────────────────────────────────────────

function buildIndexes(): void {
  const s = getStore();
  s.tagIndex.clear();
  s.ratingIndex.clear();

  for (const [id, record] of Object.entries(s.data.images)) {
    for (const tag of record.tags) {
      if (!s.tagIndex.has(tag)) s.tagIndex.set(tag, new Set());
      s.tagIndex.get(tag)!.add(id);
    }
    const r = record.rating ?? 0;
    if (!s.ratingIndex.has(r)) s.ratingIndex.set(r, new Set());
    s.ratingIndex.get(r)!.add(id);
  }
}

function addToIndexes(id: string, record: ImageRecord): void {
  const s = getStore();
  for (const tag of record.tags) {
    if (!s.tagIndex.has(tag)) s.tagIndex.set(tag, new Set());
    s.tagIndex.get(tag)!.add(id);
  }
  const r = record.rating ?? 0;
  if (!s.ratingIndex.has(r)) s.ratingIndex.set(r, new Set());
  s.ratingIndex.get(r)!.add(id);
}

function removeFromIndexes(id: string, record: ImageRecord): void {
  const s = getStore();
  for (const tag of record.tags) {
    const set = s.tagIndex.get(tag);
    if (set) {
      set.delete(id);
      if (set.size === 0) s.tagIndex.delete(tag);
    }
  }
  const r = record.rating ?? 0;
  const rSet = s.ratingIndex.get(r);
  if (rSet) {
    rSet.delete(id);
    if (rSet.size === 0) s.ratingIndex.delete(r);
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function markDirty(): void {
  const s = getStore();
  s.dirty = true;
  if (s.flushTimer) clearTimeout(s.flushTimer);
  s.flushTimer = setTimeout(() => flush(), 500);
}

export function flush(): void {
  const s = getStore();
  if (s.flushTimer) {
    clearTimeout(s.flushTimer);
    s.flushTimer = null;
  }
  if (!s.dirty || !s.currentRoot) return;

  const paths = getCollectionPaths(s.currentRoot);
  const tmpPath = paths.db + ".tmp";
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(s.data, null, 2), "utf8");
    fs.renameSync(tmpPath, paths.db);
    s.dirty = false;
    console.log("[db] Flushed");
  } catch (e) {
    console.error("[db] Flush error:", (e as Error).message);
  }
}

// ─── Load / Switch ────────────────────────────────────────────────────────────

/**
 * Flush current DB state, then load a new collection from rootPath.
 * Rebuilds indexes after loading.
 */
export function loadCollection(rootPath: string): void {
  const s = getStore();

  // Flush existing state first
  flush();

  s.currentRoot = rootPath;
  s.loaded = false;
  s.data = { version: 1, images: {}, trashedImages: {} };

  const paths = getCollectionPaths(rootPath);
  const dbPath = paths.db;
  const tmpPath = dbPath + ".tmp";

  // Recovery: prefer .tmp if main db is missing
  if (!fs.existsSync(dbPath) && fs.existsSync(tmpPath)) {
    console.log("[db] Recovering from tmp file");
    fs.renameSync(tmpPath, dbPath);
  }

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, "utf8");
      const parsed: Partial<DBData> = JSON.parse(raw);
      s.data.version = parsed.version ?? 1;
      s.data.images = parsed.images ?? {};
      s.data.trashedImages = parsed.trashedImages ?? {};
      console.log(
        `[db] Loaded: ${Object.keys(s.data.images).length} images, ` +
          `${Object.keys(s.data.trashedImages).length} trashed`,
      );
    } catch (e) {
      console.error("[db] Load error, starting fresh:", (e as Error).message);
      s.data = { version: 1, images: {}, trashedImages: {} };
      markDirty();
    }
  } else {
    console.log("[db] No existing db.json, starting fresh");
    markDirty();
  }

  // ── Migration: backfill updatedAt for records from old db format ─────────
  // Old app had no updatedAt. Without it, PATCH /api/images/[id] (which
  // requires `expectedUpdatedAt: number`) would always return 400 for those
  // records. Set updatedAt = committedAt as a sensible default.
  let migrated = false;
  for (const record of Object.values(s.data.images)) {
    if ((record.updatedAt as number | undefined) === undefined) {
      record.updatedAt = record.committedAt ?? Date.now();
      migrated = true;
    }
  }
  if (migrated) {
    console.log("[db] Migration: backfilled updatedAt for legacy records");
    markDirty();
  }

  buildIndexes();
  s.loaded = true;
}

export function isLoaded(): boolean {
  return getStore().loaded;
}

export function getCurrentRoot(): string | null {
  return getStore().currentRoot;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getImage(id: string): ImageWithId | null {
  const record = getStore().data.images[id];
  if (!record) return null;
  return { id, ...record };
}

export function listImages(opts: ListOptions = {}): ListResult {
  const s = getStore();
  const tags = opts.tags ?? [];
  const rating = opts.rating !== undefined ? Number(opts.rating) : undefined;
  const ratingOp = opts.ratingOp ?? "gte";
  const sort = opts.sort ?? "committedAt";
  const order = opts.order ?? "desc";
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));

  let ids: Set<string>;

  if (tags.length > 0) {
    const sets = tags.map((t) => s.tagIndex.get(t) ?? new Set<string>());
    if (sets.some((set) => set.size === 0)) {
      return { items: [], total: 0, page, pages: 0 };
    }
    ids = new Set(sets[0]);
    for (let i = 1; i < sets.length; i++) {
      for (const id of ids) {
        if (!sets[i].has(id)) ids.delete(id);
      }
    }
  } else {
    ids = new Set(Object.keys(s.data.images));
  }

  if (rating !== undefined) {
    const filtered = new Set<string>();
    for (const id of ids) {
      const r = s.data.images[id].rating ?? 0;
      if (ratingOp === "gte" && r >= rating) filtered.add(id);
      else if (ratingOp === "lte" && r <= rating) filtered.add(id);
      else if (ratingOp === "eq" && r === rating) filtered.add(id);
    }
    ids = filtered;
  }

  let items: ImageWithId[] = Array.from(ids).map((id) => ({ id, ...s.data.images[id] }));

  items.sort((a, b) => {
    let va: string | number, vb: string | number;
    if (sort === "rating") {
      va = a.rating ?? 0;
      vb = b.rating ?? 0;
    } else if (sort === "originalName") {
      va = (a.originalName ?? "").toLowerCase();
      vb = (b.originalName ?? "").toLowerCase();
    } else {
      va = a.committedAt ?? 0;
      vb = b.committedAt ?? 0;
    }
    if (va < vb) return order === "asc" ? -1 : 1;
    if (va > vb) return order === "asc" ? 1 : -1;
    return 0;
  });

  const total = items.length;
  const pages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  items = items.slice(start, start + limit);

  return { items, total, page, pages };
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export function commitImage(
  stagedFilename: string,
  tags: string[],
  rating: number,
  width: number,
  height: number,
): { id: string; record: ImageRecord } {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);

  let id: string;
  do {
    id = crypto.randomBytes(8).toString("hex");
  } while (s.data.images[id]);

  const ext = path.extname(stagedFilename).toLowerCase();
  const srcPath = path.join(paths.staged, stagedFilename);
  const destPath = path.join(paths.committed, id + ext);

  const stat = fs.statSync(srcPath);
  fs.renameSync(srcPath, destPath);

  const now = Date.now();
  const record: ImageRecord = {
    ext,
    originalName: stagedFilename,
    tags: tags ?? [],
    rating: rating ?? 0,
    committedAt: now,
    updatedAt: now,
    fileSize: stat.size,
    width: Number.isFinite(width) && width > 0 ? width : 0,
    height: Number.isFinite(height) && height > 0 ? height : 0,
  };

  s.data.images[id] = record;
  addToIndexes(id, record);
  markDirty();

  return { id, record };
}

// ─── Update Tags / Rating ─────────────────────────────────────────────────────

export function updateImage(
  id: string,
  patch: { tags?: string[]; rating?: number },
  expectedUpdatedAt: number,
): ImageWithId {
  const s = getStore();
  const record = s.data.images[id];
  if (!record) throw new Error("Image not found: " + id);

  if (record.updatedAt !== expectedUpdatedAt) {
    const err = Object.assign(new Error("Conflict"), { status: 409, record });
    throw err;
  }

  removeFromIndexes(id, record);

  if (patch.tags !== undefined) record.tags = patch.tags;
  if (patch.rating !== undefined) record.rating = patch.rating;
  record.updatedAt = Date.now();

  addToIndexes(id, record);
  markDirty();

  return { id, ...record };
}

// ─── Trash / Restore ─────────────────────────────────────────────────────────

export function trashImage(id: string): void {
  const s = getStore();
  const record = s.data.images[id];
  if (!record) throw new Error("Image not found: " + id);
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  const srcPath = path.join(paths.committed, id + record.ext);
  const destPath = path.join(paths.trash, id + record.ext);
  if (fs.existsSync(srcPath)) fs.renameSync(srcPath, destPath);

  removeFromIndexes(id, record);
  delete s.data.images[id];
  s.data.trashedImages[id] = { ...record, trashedAt: Date.now() };
  markDirty();
}

export function restoreImage(id: string): ImageWithId {
  const s = getStore();
  const record = s.data.trashedImages[id];
  if (!record) throw new Error("Trashed image not found: " + id);
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  const srcPath = path.join(paths.trash, id + record.ext);
  const destPath = path.join(paths.committed, id + record.ext);
  if (fs.existsSync(srcPath)) fs.renameSync(srcPath, destPath);

  delete s.data.trashedImages[id];
  const { trashedAt: _t, ...restored } = record;
  s.data.images[id] = restored;
  addToIndexes(id, restored);
  markDirty();

  return { id, ...restored };
}

// ─── Tag Operations ───────────────────────────────────────────────────────────

export function getAllTags(): TagInfo[] {
  const result: TagInfo[] = [];
  for (const [name, ids] of getStore().tagIndex) {
    result.push({ name, count: ids.size });
  }
  result.sort((a, b) => b.count - a.count);
  return result;
}

export function renameTag(oldName: string, newName: string): number {
  const s = getStore();
  const ids = s.tagIndex.get(oldName);
  if (!ids || ids.size === 0) return 0;

  let affected = 0;
  for (const id of ids) {
    const record = s.data.images[id];
    if (!record) continue;
    const idx = record.tags.indexOf(oldName);
    if (idx !== -1) {
      record.tags[idx] = newName;
      if (record.tags.filter((t) => t === newName).length > 1) {
        record.tags = [...new Set(record.tags)];
      }
      affected++;
    }
  }

  buildIndexes();
  markDirty();

  return affected;
}

// ─── Trash Operations ─────────────────────────────────────────────────────────

export function getTrash(): TrashedImageWithId[] {
  const s = getStore();
  return Object.entries(s.data.trashedImages).map(([id, record]) => ({ id, ...record }));
}

export function emptyTrash(): number {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  let count = 0;

  for (const [id, record] of Object.entries(s.data.trashedImages)) {
    const filePath = path.join(paths.trash, id + record.ext);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      console.error(`[db] Failed to delete trash file ${id}:`, (e as Error).message);
    }
    count++;
  }

  s.data.trashedImages = {};
  markDirty();
  return count;
}

export function deleteTrashedImage(id: string): void {
  const s = getStore();
  const record = s.data.trashedImages[id];
  if (!record) throw new Error("Trashed image not found: " + id);
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  const filePath = path.join(paths.trash, id + record.ext);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error(`[db] Failed to delete trash file ${id}:`, (e as Error).message);
  }

  delete s.data.trashedImages[id];
  markDirty();
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export function findOrphans(): string[] {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  const files = fs.readdirSync(paths.committed);
  const orphans: string[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    if (IMG_EXTS.has(ext) && !s.data.images[base]) {
      orphans.push(file);
    }
  }
  return orphans;
}

export function findMissing(): string[] {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  const missing: string[] = [];

  for (const [id, record] of Object.entries(s.data.images)) {
    const filePath = path.join(paths.committed, id + record.ext);
    if (!fs.existsSync(filePath)) {
      missing.push(id);
    }
  }
  return missing;
}

export function importOrphan(filename: string): { id: string; record: ImageRecord } {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, ext);

  let id: string;
  if (/^[0-9a-f]{16}$/.test(base) && !s.data.images[base]) {
    id = base;
  } else {
    do {
      id = crypto.randomBytes(8).toString("hex");
    } while (s.data.images[id]);

    const srcPath = path.join(paths.committed, filename);
    const destPath = path.join(paths.committed, id + ext);
    fs.renameSync(srcPath, destPath);
  }

  const filePath = path.join(paths.committed, id + ext);
  const stat = fs.statSync(filePath);
  const now = Date.now();

  const record: ImageRecord = {
    ext,
    originalName: filename,
    tags: [],
    rating: 0,
    committedAt: now,
    updatedAt: now,
    fileSize: stat.size,
    width: 0,
    height: 0,
  };

  s.data.images[id] = record;
  addToIndexes(id, record);
  markDirty();

  return { id, record };
}

export function removeMissing(id: string): void {
  const s = getStore();
  const record = s.data.images[id];
  if (!record) throw new Error("Image not found: " + id);

  removeFromIndexes(id, record);
  delete s.data.images[id];
  markDirty();
}

export function backupDb(): string {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  flush(); // Make sure we have the latest
  const paths = getCollectionPaths(s.currentRoot);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(s.currentRoot, `db.backup.${timestamp}.json`);

  fs.copyFileSync(paths.db, backupPath);
  console.log(`[db] Backup created: ${backupPath}`);
  return backupPath;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStats(): Stats {
  const s = getStore();
  let stagedCount = 0;

  if (s.currentRoot) {
    const paths = getCollectionPaths(s.currentRoot);
    try {
      const files = fs.readdirSync(paths.staged);
      stagedCount = files.filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase())).length;
    } catch {
      /* ignore */
    }
  }

  return {
    totalImages: Object.keys(s.data.images).length,
    totalTags: s.tagIndex.size,
    stagedCount,
    trashCount: Object.keys(s.data.trashedImages).length,
  };
}

// ─── Staged Files ─────────────────────────────────────────────────────────────

export function listStaged(): string[] {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  try {
    return fs.readdirSync(paths.staged).filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()));
  } catch {
    return [];
  }
}

export function trashStagedFile(filename: string): void {
  const s = getStore();
  if (!s.currentRoot) throw new Error("No collection loaded");

  const paths = getCollectionPaths(s.currentRoot);
  const srcPath = path.join(paths.staged, filename);
  const destPath = path.join(paths.trash, `staged_${Date.now()}_${filename}`);
  if (fs.existsSync(srcPath)) {
    fs.renameSync(srcPath, destPath);
  } else {
    throw new Error("Staged file not found: " + filename);
  }
}

// ─── Random Pair ─────────────────────────────────────────────────────────────

export function getRandomPair(): [ImageWithId, ImageWithId] | null {
  const ids = Object.keys(getStore().data.images);
  if (ids.length < 2) return null;

  const shuffled = ids.sort(() => Math.random() - 0.5);
  const [id1, id2] = shuffled.slice(0, 2);
  return [
    { id: id1, ...getStore().data.images[id1] },
    { id: id2, ...getStore().data.images[id2] },
  ];
}
