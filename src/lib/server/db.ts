/**
 * @file db.ts
 * In-memory JSON database — class definition, persistence, and singleton.
 *
 * Responsibilities of this module:
 *   - {@link JSONDatabase} class: owns all in-memory state (data, indexes, dirty flag).
 *   - HMR-safe singleton via `globalThis.__db`.
 *   - Debounced flush to `db.json` on disk.
 *   - Loading / switching the active collection.
 *
 * Query logic lives in {@link ./db-query.ts}.
 * Mutation logic lives in {@link ./db-mutation.ts}.
 * Callers import {@link getDB} and pass the instance directly to those functions.
 */

import fs from "fs";
import { getCollectionPaths } from "./config.js";
import type { DBData, ImageRecord } from "$lib/types.js";

// ─── JSONDatabase class ──────────────────────────────────────────────────────

/**
 * Encapsulates all in-memory state for the image database together with the
 * index-maintenance and persistence logic.
 *
 * Instances are normally obtained via the module-level {@link store} singleton
 * rather than being constructed directly.
 */
export class JSONDatabase {
  /** Raw database payload mirroring the on-disk `db.json` structure. */
  data: DBData;

  /** Inverted index: tag name → set of image ids that carry that tag. */
  tagIndex: Map<string, Set<string>>;

  /** Inverted index: rating value → set of image ids with that rating. */
  ratingIndex: Map<number, Set<string>>;

  /** Whether in-memory state differs from the last persisted snapshot. */
  dirty: boolean;

  /** Handle for the debounced flush timer, or `null` when idle. */
  flushTimer: ReturnType<typeof setTimeout> | null;

  /** Absolute path of the currently loaded collection root, or `null`. */
  currentRoot: string | null;

  /** `true` once a collection has been successfully loaded. */
  loaded: boolean;

  /** Initialises all fields to safe empty defaults. */
  constructor() {
    this.data = { version: 1, images: {} };
    this.tagIndex = new Map();
    this.ratingIndex = new Map();
    this.dirty = false;
    this.flushTimer = null;
    this.currentRoot = null;
    this.loaded = false;
  }

  // ─── Index helpers ─────────────────────────────────────────────────────────

  /**
   * Rebuilds both the tag index and the rating index from scratch using
   * the current {@link data} snapshot.  Call this after bulk edits where
   * incremental {indexAdd}/{indexRemove} updates would be impractical.
   */
  buildIndexes(): void {
    this.tagIndex.clear();
    this.ratingIndex.clear();
    for (const [id, rec] of Object.entries(this.data.images)) {
      this.indexAdd(id, rec);
    }
  }

  /**
   * Adds a single image record to both the tag and rating indexes.
   *
   * @param id - The image identifier.
   * @param rec - The image record whose tags and rating should be indexed.
   */
  indexAdd(id: string, rec: ImageRecord): void {
    for (const tag of rec.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(id);
    }
    const r = rec.rating ?? 0;
    if (!this.ratingIndex.has(r)) this.ratingIndex.set(r, new Set());
    this.ratingIndex.get(r)!.add(id);
  }

  /**
   * Removes a single image record from both the tag and rating indexes.
   * Empty index buckets are pruned automatically.
   *
   * @param id - The image identifier.
   * @param rec - The image record to deindex.
   */
  indexRemove(id: string, rec: ImageRecord): void {
    for (const tag of rec.tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.tagIndex.delete(tag);
      }
    }
    const r = rec.rating ?? 0;
    const rSet = this.ratingIndex.get(r);
    if (rSet) {
      rSet.delete(id);
      if (rSet.size === 0) this.ratingIndex.delete(r);
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  /**
   * Marks the database as having unsaved changes and schedules a debounced
   * flush to disk after 500 ms.  Any previously scheduled flush is cancelled
   * and rescheduled.
   */
  markDirty(): void {
    this.dirty = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 500);
  }

  /**
   * Writes the current {@link data} snapshot to `db.json` via an atomic
   * rename of a `.tmp` file.  Clears the dirty flag on success.
   *
   * Calling this when the database is not dirty or has no `currentRoot` is a
   * safe no-op.
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty || !this.currentRoot) return;

    const dbPath = getCollectionPaths(this.currentRoot).db;
    const tmp = dbPath + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tmp, dbPath);
      this.dirty = false;
      console.log("[db] Flushed");
    } catch (e) {
      console.error("[db] Flush error:", (e as Error).message);
    }
  }

  // ─── Load / Switch ─────────────────────────────────────────────────────────

  /**
   * Flushes any pending changes, then loads the `db.json` located at
   * `rootPath`.  If the main file is missing but a `.tmp` recovery file
   * exists it is promoted automatically.  An entirely missing database
   * starts fresh and is immediately marked dirty so it will be persisted.
   *
   * @param rootPath - Absolute path to the collection root directory.
   */
  loadCollection(rootPath: string): void {
    this.flush();

    this.currentRoot = rootPath;
    this.loaded = false;
    this.data = { version: 1, images: {} };

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
        this.data.version = parsed.version ?? 1;
        this.data.images = parsed.images ?? {};
        console.log(`[db] Loaded: ${Object.keys(this.data.images).length} images`);
      } catch (e) {
        console.error("[db] Load error, starting fresh:", (e as Error).message);
        this.data = { version: 1, images: {} };
        this.markDirty();
      }
    } else {
      console.log("[db] No existing db.json, starting fresh");
      this.markDirty();
    }

    this.buildIndexes();
    this.loaded = true;
  }

  /**
   * Returns `true` when a collection has been loaded and the database is
   * ready to serve queries.
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Returns the absolute path of the currently active collection root, or
   * `null` if no collection has been loaded yet.
   */
  getCurrentRoot(): string | null {
    return this.currentRoot;
  }
}

// ─── HMR-safe singleton ──────────────────────────────────────────────────────

declare global {
  /** HMR guard: reuse the existing {@link JSONDatabase} instance across hot reloads. */
  var __db: JSONDatabase | undefined;
}

/**
 * Returns the module-level {@link JSONDatabase} singleton, creating it on
 * first access.  The instance is stored on `globalThis` so Vite HMR does not
 * reset it between reloads.
 *
 * Import this in server-side modules and pass the result directly to functions
 * in `db-query.ts` or `db-mutation.ts`, or call lifecycle methods on it.
 *
 * @example
 * ```ts
 * import { getDB } from "$lib/server/db.js";
 * import { queryImages } from "$lib/server/db-query.js";
 *
 * const images = queryImages(getDB(), { tags: ["cat"] });
 * ```
 */
export function getDB(): JSONDatabase {
  if (!globalThis.__db) {
    globalThis.__db = new JSONDatabase();
  }
  return globalThis.__db;
}
