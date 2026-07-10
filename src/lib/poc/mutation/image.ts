/**
 * @file image.ts
 * ImageCommands —— 專心做圖片異動：commit / update / updateFileMeta / remove。
 *
 * 動詞坐在 database 原語上（read-overlay-write）：合併語意住動詞、原語只做覆寫。
 * 寫真相後組合索引原語（indexRemove/indexAdd）同步投影，再 markDirty。
 */

import type { Database, ImageRecord, ImageWithId } from "../database/index.js";
import type { FileInfo, FileMetaPatch, ImportEntry, UpdatePatch } from "./commands.js";
import { Validator } from "./validator.js";
import { ok, notFound, staleUpdate, invalid } from "./result.js";
import type { NotFound, Result, StaleUpdate, Validation } from "./result.js";
import { sortCollator } from "$lib/utils/shared.js";

/** 標籤正規化：修剪 + 自然排序（寫入真相前的統一形狀）。 */
function normalizeTags(tags: string[]): string[] {
  return tags.map((t) => t.trim()).toSorted(sortCollator.compare);
}

export class ImageCommands {
  constructor(private db: Database) {}

  /**
   * 提交（或覆寫）一筆圖片紀錄。使用者可控欄位來自 `entry`，
   * 檔案側元資料由呼叫端向 image 模組取得後以 `file` 傳入。
   */
  commit(id: string, entry: ImportEntry, file: FileInfo): Result<ImageWithId, Validation> {
    if (!Validator.name(entry.name)) return invalid(["name"], "名稱不合法");
    if (!Validator.tags(entry.tags)) return invalid(["tags"], "標籤不合法");
    if (entry.rating !== undefined && !Validator.rating(entry.rating)) return invalid(["rating"], "評分不合法");

    const db = this.db;
    const existing = db.getImage(id);
    if (existing) db.indexRemove(id, existing);

    const now = Date.now();
    const record: ImageRecord = {
      name: entry.name,
      tags: normalizeTags(entry.tags),
      rating: entry.rating ?? 0,
      committedAt: now,
      updatedAt: now,
      fileSize: file.fileSize,
      width: file.width,
      height: file.height,
      blurhash: file.blurhash,
    };

    db.setImage(id, record);
    db.indexAdd(id, record);
    db.markDirty();

    return ok({ id, ...record });
  }

  /** 以樂觀併發檢查更新現有圖片的標籤 / 評分 / 名稱。 */
  update(id: string, patch: UpdatePatch): Result<ImageWithId, NotFound | StaleUpdate | Validation> {
    const db = this.db;
    const record = db.getImage(id);
    if (!record) return notFound();
    if (record.updatedAt !== patch.expectedUpdatedAt) return staleUpdate(patch.expectedUpdatedAt, record.updatedAt);

    if (patch.name !== undefined && !Validator.name(patch.name)) return invalid(["name"], "名稱不合法");
    if (patch.tags !== undefined && !Validator.tags(patch.tags)) return invalid(["tags"], "標籤不合法");
    if (patch.rating !== undefined && !Validator.rating(patch.rating)) return invalid(["rating"], "評分不合法");

    // read-overlay-write：完整基底 → 覆蓋 → 完整 record
    const next: ImageRecord = { ...record };
    if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags);
    if (patch.rating !== undefined) next.rating = patch.rating;
    if (patch.name !== undefined) next.name = patch.name;
    next.updatedAt = Date.now();

    db.indexRemove(id, record);
    db.setImage(id, next);
    db.indexAdd(id, next);
    db.markDirty();

    return ok({ id, ...next });
  }

  /**
   * 更新圖片的檔案側元資料（尺寸、blurhash），不經樂觀併發檢查、不更動 `updatedAt`。
   * 這些欄位不進投影索引，故無須 indexRemove/indexAdd。僅供維護用途。
   */
  updateFileMeta(id: string, meta: FileMetaPatch): Result<ImageWithId, NotFound> {
    const db = this.db;
    const record = db.getImage(id);
    if (!record) return notFound();

    const next: ImageRecord = { ...record, ...meta };
    db.setImage(id, next);
    db.markDirty();

    return ok({ id, ...next });
  }

  /** 移除已提交的圖片紀錄並回傳。 */
  remove(id: string): Result<ImageRecord, NotFound> {
    const db = this.db;
    const record = db.getImage(id);
    if (!record) return notFound();

    db.indexRemove(id, record);
    db.deleteImage(id);
    db.markDirty();

    return ok(record);
  }
}
