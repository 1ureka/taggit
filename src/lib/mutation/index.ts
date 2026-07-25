/**
 * @file mutation/index.ts
 * 對資料庫操作 (命令) 的公開入口
 */

import type { Database, ImageRecord, ImageWithId } from "$lib/database";

import { ImageCommands } from "./image";
import { TagCommands } from "./tag";
import type { FileInfo, FileMetaPatch } from "./commands";
import type { AlreadyExists, LastTag, NotFound, Result, StaleUpdate, Validation } from "./result";

export type { FileInfo, FileMetaPatch } from "./commands";
export type { Result, MutationError, NotFound, AlreadyExists, StaleUpdate, LastTag, Validation } from "./result";

export class Mutation {
  private images: ImageCommands;
  private tags: TagCommands;

  constructor(db: Database) {
    this.images = new ImageCommands(db);
    this.tags = new TagCommands(db);
  }

  /** 新增一筆圖片紀錄。使用者可控欄位來自 `entry`，檔案側元資料由呼叫端向 image 模組取得後以 `file` 傳入 */
  commitRecord(id: string, entry: unknown, file: FileInfo): Result<ImageWithId, AlreadyExists | Validation> {
    return this.images.commit(id, entry, file);
  }

  /** 以 `entry` 的內容還原一筆圖片紀錄，`id` 已存在時直接覆寫，只在必要時才使用，目前僅供匯入使用 */
  restoreRecord(id: string, entry: unknown, file: FileInfo): Result<ImageWithId, Validation> {
    return this.images.restore(id, entry, file);
  }

  /** 以樂觀併發檢查更新現有圖片的標籤 / 評分 / 名稱 */
  updateRecord(id: string, patch: unknown): Result<ImageWithId, NotFound | StaleUpdate | Validation> {
    return this.images.update(id, patch);
  }

  /** 更新圖片的檔案元資料，不經樂觀併發檢查、不更動 `updatedAt` 也不影響索引 */
  updateRecordFileMeta(id: string, meta: FileMetaPatch): Result<ImageWithId, NotFound> {
    return this.images.updateFileMeta(id, meta);
  }

  /** 移除已提交的圖片紀錄並回傳該紀錄，也可以理解為 "退回" */
  removeRecord(id: string): Result<ImageRecord, NotFound> {
    return this.images.remove(id);
  }

  /** 在所有使用該標籤的圖片中重新命名標籤，並搬移元資料 */
  renameTag(oldName: unknown, newName: unknown): Result<{ affected: number }, NotFound | Validation> {
    return this.tags.rename(oldName, newName);
  }

  /** 從所有使用該標籤的圖片中移除指定標籤，並刪除其元資料 */
  deleteTag(name: unknown): Result<{ affected: number }, LastTag | NotFound | Validation> {
    return this.tags.delete(name);
  }

  /** 覆寫標籤元資料 */
  setTagMeta(name: unknown, meta: unknown): Result<void, Validation> {
    return this.tags.setMeta(name, meta);
  }
}
