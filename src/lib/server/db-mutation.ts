/**
 * @file db-mutation.ts
 * Write / mutation functions for the image database.
 *
 * Every function accepts a {@link JSONDatabase} instance as its first argument
 * so it can be used independently of the module-level singleton, keeping the
 * mutation logic testable and decoupled from persistence concerns.
 *
 * None of these functions perform file-system operations — they only update
 * in-memory records and indexes, then mark the database dirty so the debounced
 * flush in {@link JSONDatabase} can persist the changes.
 */

import type { JSONDatabase } from "./db.js";
import type { ImageRecord, ImageWithId } from "$lib/types.js";

// ─── Record mutations ───────────────────────────────────────────────────────

/**
 * Inserts a new committed image record into the database.
 *
 * @param jsonDB - The database instance to mutate.
 * @param id - The unique identifier for the new image.
 * @param record - The image metadata to store.
 */
export function addImage(jsonDB: JSONDatabase, id: string, record: ImageRecord): void {
  jsonDB.data.images[id] = record;
  jsonDB.indexAdd(id, record);
  jsonDB.markDirty();
}

/**
 * Removes a committed image record from the database and returns it.
 *
 * @param jsonDB - The database instance to mutate.
 * @param id - The unique identifier of the image to remove.
 * @throws {Error} If no record with the given id exists.
 */
export function removeImage(jsonDB: JSONDatabase, id: string): ImageRecord {
  const rec = jsonDB.data.images[id];
  if (!rec) throw new Error("Image not found: " + id);
  jsonDB.indexRemove(id, rec);
  delete jsonDB.data.images[id];
  jsonDB.markDirty();
  return rec;
}

/**
 * Updates the tags and/or rating of an existing image record using an
 * optimistic-concurrency check.
 *
 * @param jsonDB - The database instance to mutate.
 * @param id - The unique identifier of the image to update.
 * @param patch - Fields to update (`tags` and/or `rating`).
 * @param expectedUpdatedAt - The `updatedAt` timestamp the caller last saw.
 *   If the stored record has a different timestamp the update is rejected with
 *   a `409 Conflict` error that includes the current record.
 * @returns The updated image with its id attached.
 * @throws {Error} If no record with the given id exists.
 * @throws {Error & { status: 409; record: ImageWithId }} On a concurrency conflict.
 */
export function updateImage(
  jsonDB: JSONDatabase,
  id: string,
  patch: { tags?: string[]; rating?: number },
  expectedUpdatedAt: number,
): ImageWithId {
  const rec = jsonDB.data.images[id];
  if (!rec) throw new Error("Image not found: " + id);

  if (rec.updatedAt !== expectedUpdatedAt) {
    throw Object.assign(new Error("Conflict"), { status: 409, record: { id, ...rec } });
  }

  jsonDB.indexRemove(id, rec);
  if (patch.tags !== undefined) rec.tags = patch.tags;
  if (patch.rating !== undefined) rec.rating = patch.rating;
  rec.updatedAt = Date.now();
  jsonDB.indexAdd(id, rec);
  jsonDB.markDirty();

  return { id, ...rec };
}

// ─── Tag mutations ──────────────────────────────────────────────────────────

/**
 * Renames a tag across every image record that uses it.
 *
 * If `newName` already exists on a record that also has `oldName`, the
 * duplicate is removed so each tag appears at most once per image.
 *
 * @param jsonDB - The database instance to mutate.
 * @param oldName - The tag name to rename.
 * @param newName - The replacement tag name.
 * @returns The number of image records that were affected.
 */
export function renameTag(jsonDB: JSONDatabase, oldName: string, newName: string): number {
  const ids = jsonDB.tagIndex.get(oldName);
  if (!ids || ids.size === 0) return 0;

  let affected = 0;
  for (const id of ids) {
    const rec = jsonDB.data.images[id];
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

  jsonDB.buildIndexes();
  jsonDB.markDirty();
  return affected;
}
