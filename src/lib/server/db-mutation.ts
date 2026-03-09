/**
 * @file db-mutation.ts
 * 圖片資料庫的寫入／異動函式。
 *
 * 每個函式都接受 {@link JSONDatabase} 作為第一個參數，
 * 不依賴模組層級的 singleton，使異動邏輯易於測試且與持久化解耦。
 *
 * 這些函式不直接操作檔案系統 —— 只更新記憶體內的紀錄與索引，
 * 再標記資料庫為 dirty，由 {@link JSONDatabase} 的防抖寫入負責持久化。
 */

import type { JSONDatabase } from "./db.js";
import type { ImageRecord, ImageWithId } from "$lib/types.js";

// ---

/**
 * 將新的已提交圖片記錄寫入資料庫。
 *
 * @param jsonDB - 要異動的資料庫實例。
 * @param id - 新圖片的唯一識別碼。
 * @param record - 要儲存的圖片中繼資料。
 */
export function addImage(jsonDB: JSONDatabase, id: string, record: ImageRecord): void {
  jsonDB.data.images[id] = record;
  jsonDB.indexAdd(id, record);
  jsonDB.markDirty();
}

/**
 * 從資料庫移除已提交的圖片記錄並回傳。
 *
 * @param jsonDB - 要異動的資料庫實例。
 * @param id - 要移除的圖片唯一識別碼。
 * @throws {Error} 若指定 id 的記錄不存在。
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
 * 圖片更新補丁 —— 傳入 {@link updateImage} 以部分更新圖片記錄。
 * 除 `expectedUpdatedAt` 外，所有欄位皆為選填。
 */
interface UpdateImagePatch {
  /** 呼叫端最後一次看到的 `updatedAt` 時間戳，用於樂觀併發控制。 */
  expectedUpdatedAt: number;
  /** 替換後的標籤列表。 */
  tags?: ImageRecord["tags"];
  /** 替換後的評分。 */
  rating?: ImageRecord["rating"];
  /** 替換後的圖片名稱。 */
  name?: ImageRecord["name"];
}

/**
 * 使用樂觀併發檢查更新現有圖片記錄的標籤及／或評分。
 *
 * @param jsonDB - 要異動的資料庫實例。
 * @param id - 要更新的圖片唯一識別碼。
 * @param patch - 包含 `expectedUpdatedAt` 與要更新欄位的補丁物件。
 * @returns 附帶 id 的已更新圖片。
 * @throws {Error} 若指定 id 的記錄不存在。
 * @throws {Error & { status: 409; record: ImageWithId }} 發生併發衝突時。
 */
export function updateImage(jsonDB: JSONDatabase, id: string, patch: UpdateImagePatch): ImageWithId {
  const rec = jsonDB.data.images[id];

  if (!rec) {
    throw new Error("Image not found: " + id);
  }

  if (rec.updatedAt !== patch.expectedUpdatedAt) {
    throw Object.assign(new Error("Conflict"), { status: 409, record: { id, ...rec } });
  }

  jsonDB.indexRemove(id, rec);

  if (patch.tags !== undefined) rec.tags = patch.tags;
  if (patch.rating !== undefined) rec.rating = patch.rating;
  if (patch.name !== undefined) rec.name = patch.name;

  rec.updatedAt = Date.now();

  jsonDB.indexAdd(id, rec);
  jsonDB.markDirty();

  return { id, ...rec };
}

// ---

/**
 * 在所有使用該標籤的圖片記錄中重新命名標籤。
 *
 * 若某筆記錄同時擁有 `oldName` 和 `newName`，
 * 重複項會被移除，確保每張圖片的標籤不重複。
 *
 * @param jsonDB - 要異動的資料庫實例。
 * @param oldName - 要重新命名的標籤名稱。
 * @param newName - 替換後的標籤名稱。
 * @returns 受影響的圖片記錄數量。
 */
export function renameTag(jsonDB: JSONDatabase, oldName: string, newName: string): number {
  if (oldName === newName) return 0;

  const ids = jsonDB.tagIndex.get(oldName);
  if (!ids || ids.size === 0) return 0;

  let affected = 0;

  for (const id of ids) {
    const rec = jsonDB.data.images[id];
    if (!rec) continue;

    if (rec.tags.includes(newName)) {
      rec.tags = rec.tags.filter((t) => t !== oldName);
    } else {
      const idx = rec.tags.indexOf(oldName);
      if (idx !== -1) rec.tags[idx] = newName;
    }

    affected++;
  }

  jsonDB.buildIndexes();
  jsonDB.markDirty();
  return affected;
}
