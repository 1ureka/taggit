/**
 * @file poc/mutation/index.ts
 * 命令的公開入口 —— 只匯出 `Mutation` class（＋錯誤模型 / 命令型別 re-export）。
 *
 * `Mutation` 建構時注入 db（authority-free，不碰單例），造出 image / tag 兩組命令並委派。
 * 方法 per-method 收窄 E，文件化「這個方法可能怎麼失敗」。子檔不對模組外露出。
 *
 * **不匯出 errorToHttp**：HTTP 映射是 route 政策（屬 $lib/utils/server），不是寫入機制。
 */

import type { Database, ImageRecord, ImageWithId, TagMeta } from "../database/index.js";
import { ImageCommands } from "./image.js";
import { TagCommands } from "./tag.js";
import type { FileInfo, FileMetaPatch, ImportEntry, UpdatePatch } from "./commands.js";
import type { LastTag, NotFound, Result, StaleUpdate, Validation } from "./result.js";

export type { ImportEntry, FileInfo, UpdatePatch, FileMetaPatch } from "./commands.js";
export type { Result, MutationError, NotFound, StaleUpdate, LastTag, Validation } from "./result.js";

export class Mutation {
  private images: ImageCommands;
  private tags: TagCommands;

  constructor(db: Database) {
    this.images = new ImageCommands(db);
    this.tags = new TagCommands(db);
  }

  commitRecord(id: string, entry: ImportEntry, file: FileInfo): Result<ImageWithId, Validation> {
    return this.images.commit(id, entry, file);
  }

  updateRecord(id: string, patch: UpdatePatch): Result<ImageWithId, NotFound | StaleUpdate | Validation> {
    return this.images.update(id, patch);
  }

  updateRecordFileMeta(id: string, meta: FileMetaPatch): Result<ImageWithId, NotFound> {
    return this.images.updateFileMeta(id, meta);
  }

  removeRecord(id: string): Result<ImageRecord, NotFound> {
    return this.images.remove(id);
  }

  renameTag(oldName: string, newName: string): Result<{ affected: number }, Validation> {
    return this.tags.rename(oldName, newName);
  }

  deleteTag(name: string): Result<{ affected: number }, LastTag | Validation> {
    return this.tags.delete(name);
  }

  setTagMeta(name: string, meta: TagMeta): Result<void, Validation> {
    return this.tags.setMeta(name, meta);
  }
}
