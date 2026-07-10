/**
 * @file image.ts
 * 圖片紀錄操作 commit / update / updateFileMeta / remove
 */

import { sortCollator } from "$lib/utils/shared";
import type { Database, ImageRecord, ImageWithId } from "$lib/poc/database";

import type { FileInfo, FileMetaPatch, ImportEntry, UpdatePatch } from "./commands";
import type { NotFound, Result, StaleUpdate, Validation } from "./result";
import { Validator } from "./validator";
import { ok, notFound, staleUpdate, invalid } from "./result";

/** 標籤正規化：修剪 + 自然排序 */
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
    const existing = db.getImage(id); // null（新增）或舊紀錄（覆寫）

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
    db.replaceIndex(id, existing);
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

    const next: ImageRecord = { ...record };
    if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags);
    if (patch.rating !== undefined) next.rating = patch.rating;
    if (patch.name !== undefined) next.name = patch.name;
    next.updatedAt = Date.now();

    db.setImage(id, next);
    db.replaceIndex(id, record);
    db.markDirty();

    return ok({ id, ...next });
  }

  /**
   * 更新圖片的檔案側元資料，不經樂觀併發檢查、不更動 `updatedAt` 也不影響索引
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

  /**
   * 移除已提交的圖片紀錄並回傳該紀錄，也可以理解為 "退回"
   */
  remove(id: string): Result<ImageRecord, NotFound> {
    const db = this.db;
    const record = db.getImage(id);
    if (!record) return notFound();

    db.deleteImage(id);
    db.replaceIndex(id, record);
    db.markDirty();

    return ok(record);
  }
}
