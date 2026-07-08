/**
 * @file mutation.ts
 * 圖片資料庫的寫入／異動函式。
 *
 * 每個函式都接受 {@link Database} 作為第一個參數，
 * 不依賴模組層級的 singleton，使異動邏輯易於測試且與持久化解耦。
 *
 * 這些函式不直接操作檔案系統 —— 只更新記憶體內的紀錄與索引，
 * 再標記資料庫為 dirty，由 {@link Database} 的防抖寫入負責持久化。
 */

import type { Database } from "./store.js";
import type { FileInfo, ImageRecord, ImageWithId, ImportEntry, TagMeta, UpdatePatch } from "./types.js";
import { DEFAULT_TAG_META, pruneTagMeta } from "./schema.js";
import { sortCollator } from "$lib/utils.js";

// ---

/**
 * 提交（或覆寫）一筆圖片紀錄。
 *
 * 使用者可控欄位（名稱、標籤、評分）來自 `entry`，
 * 檔案側元資料（大小、尺寸、blurhash）由上層 API 向 image 模組取得後以
 * `file` 傳入 —— database 模組不在意檔案實際存不存在。
 *
 * 若 `id` 已存在，會先清理舊紀錄的索引再寫入新紀錄。
 */
export function commitRecord(db: Database, id: string, entry: ImportEntry, file: FileInfo): ImageWithId {
  const existing = db.data.images[id];
  if (existing) {
    db.indexRemove(id, existing);
  }

  const now = Date.now();
  const record: ImageRecord = {
    name: entry.name,
    tags: entry.tags.map((t) => t.trim()).toSorted(sortCollator.compare),
    rating: entry.rating ?? 0,
    committedAt: now,
    updatedAt: now,
    fileSize: file.fileSize,
    width: file.width,
    height: file.height,
    blurhash: file.blurhash,
  };

  db.data.images[id] = record;
  db.indexAdd(id, record);
  db.markDirty();

  return { id, ...record };
}

/**
 * 從資料庫移除已提交的圖片記錄並回傳。
 *
 * @throws {Error & { status: 404 }} 若指定 id 的記錄不存在。
 */
export function removeRecord(db: Database, id: string): ImageRecord {
  const rec = db.data.images[id];

  if (!rec) {
    throw Object.assign(new Error("找不到圖片: " + id), { status: 404 });
  }

  db.indexRemove(id, rec);
  delete db.data.images[id];
  db.markDirty();

  return rec;
}

/**
 * 使用樂觀併發檢查更新現有圖片記錄的標籤、評分或名稱。
 *
 * @throws {Error & { status: 404 }} 若指定 id 的記錄不存在。
 * @throws {Error & { status: 409 }} 發生併發衝突時。
 */
export function updateRecord(db: Database, id: string, patch: UpdatePatch): ImageWithId {
  const record = db.data.images[id];

  if (!record) {
    throw Object.assign(new Error("找不到圖片"), { status: 404 });
  }

  if (record.updatedAt !== patch.expectedUpdatedAt) {
    throw Object.assign(new Error("併發衝突"), { status: 409 });
  }

  db.indexRemove(id, record);

  const newRecord = { ...record };
  if (patch.tags !== undefined) newRecord.tags = patch.tags.map((t) => t.trim()).toSorted(sortCollator.compare);
  if (patch.rating !== undefined) newRecord.rating = patch.rating;
  if (patch.name !== undefined) newRecord.name = patch.name;

  newRecord.updatedAt = Date.now();

  db.data.images[id] = newRecord;
  db.indexAdd(id, newRecord);
  db.markDirty();

  return { id, ...newRecord };
}

/**
 * 更新圖片的檔案側元資料（尺寸、blurhash），不經樂觀併發檢查。
 * 僅供維護用途（settings 的補算元資料）使用；不更動 `updatedAt`。
 *
 * @throws {Error & { status: 404 }} 若指定 id 的記錄不存在。
 */
export function updateRecordFileMeta(
  db: Database,
  id: string,
  meta: Partial<Pick<ImageRecord, "width" | "height" | "blurhash">>,
): ImageWithId {
  const record = db.data.images[id];

  if (!record) {
    throw Object.assign(new Error("找不到圖片"), { status: 404 });
  }

  const newRecord = { ...record, ...meta };
  db.data.images[id] = newRecord;
  db.markDirty();

  return { id, ...newRecord };
}

// ---

/**
 * 在所有使用該標籤的圖片記錄中重新命名標籤。
 *
 * 若某筆記錄同時擁有 `oldName` 和 `newName`，重複項會被移除。
 * 標籤元資料隨改名搬移；若 `newName` 已有元資料，保留 `newName` 既有設定
 * （改名到既有標籤 = 併入對方，遵從對方的設定）。
 *
 * @returns 受影響的圖片記錄數量。
 */
export function renameTag(db: Database, oldName: string, newName: string): number {
  if (oldName === newName) return 0;

  const bits = db.facets.getTagBits(oldName);
  if (!bits) return 0;

  let affected = 0;

  for (const ordinal of [...bits.values()]) {
    const id = db.ordinals.idOf(ordinal);
    if (id === null) continue;

    const record = db.data.images[id];
    if (!record) continue;

    if (record.tags.includes(newName)) {
      db.data.images[id] = { ...record, tags: record.tags.filter((t) => t !== oldName) };
    } else {
      const newTags = record.tags.map((t) => (t === oldName ? newName : t)).toSorted(sortCollator.compare);
      db.data.images[id] = { ...record, tags: newTags };
    }

    affected++;
  }

  // 元資料搬移：newName 已有設定時遵從對方
  const oldMeta = db.data.tags[oldName];
  if (oldMeta) {
    if (!db.data.tags[newName]) db.data.tags[newName] = oldMeta;
    delete db.data.tags[oldName];
  }

  db.rebuildIndexes();
  db.markDirty();
  return affected;
}

/**
 * 從所有使用該標籤的圖片記錄中移除指定標籤，並刪除其元資料。
 *
 * @throws {Error & { status: 409 }} 若有圖片只剩下該標籤（刪除會使其沒有任何標籤）。
 * @returns 受影響的圖片記錄數量。
 */
export function deleteTag(db: Database, tagName: string): number {
  const bits = db.facets.getTagBits(tagName);

  if (bits) {
    // 衝突檢查：任何圖片都不得因此失去最後一個標籤
    for (const ordinal of bits.values()) {
      const id = db.ordinals.idOf(ordinal);
      if (id === null) continue;

      const record = db.data.images[id];
      if (record && record.tags.length === 1) {
        throw Object.assign(new Error("conflict"), { status: 409 });
      }
    }
  }

  let affected = 0;

  if (bits) {
    for (const ordinal of [...bits.values()]) {
      const id = db.ordinals.idOf(ordinal);
      if (id === null) continue;

      const record = db.data.images[id];
      if (!record) continue;

      db.data.images[id] = { ...record, tags: record.tags.filter((t) => t !== tagName) };
      affected++;
    }
  }

  const hadMeta = tagName in db.data.tags;
  delete db.data.tags[tagName];

  if (affected > 0 || hadMeta) {
    db.rebuildIndexes();
    db.markDirty();
  }

  return affected;
}

// ---

/**
 * 合併寫入標籤元資料。寫入後若全為預設值，直接刪除表項（維持稀疏）。
 * 元資料獨立於標籤的使用狀態存在 —— 允許為目前未使用的標籤名稱設定。
 */
export function setTagMeta(db: Database, name: string, meta: Partial<TagMeta>): void {
  const merged = { ...db.data.tags[name], ...meta };
  const pruned = pruneTagMeta(merged);

  if (pruned) {
    db.data.tags[name] = pruned;
  } else {
    delete db.data.tags[name];
  }

  db.markDirty();
}

/**
 * 讀取標籤元資料，補齊預設值後回傳。
 */
export function getTagMeta(db: Database, name: string): TagMeta {
  return { ...DEFAULT_TAG_META, ...db.data.tags[name] };
}
