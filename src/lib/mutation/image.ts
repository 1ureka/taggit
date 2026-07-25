/**
 * @file image.ts
 * 圖片紀錄操作 commit / restore / update / updateFileMeta / remove
 */

import { sortCollator } from "$lib/utils/shared";
import type { Database, ImageRecord, ImageWithId } from "$lib/database";

import type { FileInfo, FileMetaPatch } from "./commands";
import type { AlreadyExists, NotFound, Result, StaleUpdate, Validation } from "./result";
import { Validator } from "./validator";
import { ok, notFound, alreadyExists, staleUpdate, invalid } from "./result";

/** 標籤正規化：修剪 + 自然排序 */
function normalizeTags(tags: string[]): string[] {
  return tags.map((t) => t.trim()).toSorted(sortCollator.compare);
}

export class ImageCommands {
  constructor(private db: Database) {}

  /** 驗證使用者可控欄位並組成完整紀錄 */
  private build(entry: unknown, file: FileInfo): Result<ImageRecord, Validation> {
    if (!Validator.record(entry)) return invalid(["entry"], "紀錄格式無效");

    const { name, tags, rating } = entry;
    if (!Validator.name(name)) return invalid(["name"], "名稱不合法");
    if (!Validator.tags(tags)) return invalid(["tags"], "標籤不合法");
    if (rating !== undefined && !Validator.rating(rating)) return invalid(["rating"], "評分不合法");

    const now = Date.now();
    return ok({
      name: name.trim(),
      tags: normalizeTags(tags),
      rating: rating ?? 0,
      committedAt: now,
      updatedAt: now,
      fileSize: file.fileSize,
      width: file.width,
      height: file.height,
      blurhash: file.blurhash,
    });
  }

  /** 寫入紀錄並同步標籤投影，`previous` 為該 id 原本的紀錄（新增時為 null）。 */
  private write(id: string, record: ImageRecord, previous: ImageRecord | null): ImageWithId {
    const db = this.db;
    db.setImage(id, record);
    db.replaceIndex(id, previous);
    db.markDirty();
    return { id, ...record };
  }

  /** 新增一筆圖片紀錄。使用者可控欄位來自 `entry`，檔案側元資料由呼叫端向 image 模組取得後以 `file` 傳入 */
  commit(id: string, entry: unknown, file: FileInfo): Result<ImageWithId, AlreadyExists | Validation> {
    if (this.db.getImage(id)) return alreadyExists();

    const built = this.build(entry, file);
    if (!built.ok) return built;

    return ok(this.write(id, built.data, null));
  }

  /** 以 `entry` 的內容還原一筆圖片紀錄，`id` 已存在時直接覆寫，只在必要時才使用，目前僅供匯入使用 */
  restore(id: string, entry: unknown, file: FileInfo): Result<ImageWithId, Validation> {
    const built = this.build(entry, file);
    if (!built.ok) return built;

    return ok(this.write(id, built.data, this.db.getImage(id)));
  }

  /** 以樂觀併發檢查更新現有圖片的標籤 / 評分 / 名稱 */
  update(id: string, patch: unknown): Result<ImageWithId, NotFound | StaleUpdate | Validation> {
    if (!Validator.record(patch)) return invalid(["patch"], "更新內容格式無效");

    const { expectedUpdatedAt, name, tags, rating } = patch;
    if (!Validator.timestamp(expectedUpdatedAt)) return invalid(["expectedUpdatedAt"], "無效的預期更新時間");

    const db = this.db;
    const record = db.getImage(id);
    if (!record) return notFound();
    if (record.updatedAt !== expectedUpdatedAt) return staleUpdate(expectedUpdatedAt, record.updatedAt);

    if (name !== undefined && !Validator.name(name)) return invalid(["name"], "名稱不合法");
    if (tags !== undefined && !Validator.tags(tags)) return invalid(["tags"], "標籤不合法");
    if (rating !== undefined && !Validator.rating(rating)) return invalid(["rating"], "評分不合法");

    const next: ImageRecord = { ...record };
    if (tags !== undefined) next.tags = normalizeTags(tags);
    if (rating !== undefined) next.rating = rating;
    if (name !== undefined) next.name = name.trim();
    next.updatedAt = Date.now();

    return ok(this.write(id, next, record));
  }

  /** 更新圖片的檔案元資料，不經樂觀併發檢查、不更動 `updatedAt` 也不影響索引 */
  updateFileMeta(id: string, meta: FileMetaPatch): Result<ImageWithId, NotFound> {
    const db = this.db;
    const record = db.getImage(id);
    if (!record) return notFound();

    const next: ImageRecord = { ...record, ...meta };
    db.setImage(id, next);
    db.markDirty();

    return ok({ id, ...next });
  }

  /** 移除已提交的圖片紀錄並回傳該紀錄，也可以理解為 "退回" */
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
