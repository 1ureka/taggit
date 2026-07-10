/**
 * @file poc/mutation/index.ts
 * 對資料庫操作 (命令) 的公開入口
 */

import type { Database, ImageRecord, ImageWithId } from "$lib/poc/database";

import { ImageCommands } from "./image";
import { TagCommands } from "./tag";
import type { FileInfo, FileMetaPatch } from "./commands";
import type { LastTag, NotFound, Result, StaleUpdate, Validation } from "./result";

export type { FileInfo, FileMetaPatch } from "./commands";
export type { Result, MutationError, NotFound, StaleUpdate, LastTag, Validation } from "./result";

export class Mutation {
  private images: ImageCommands;
  private tags: TagCommands;

  constructor(db: Database) {
    this.images = new ImageCommands(db);
    this.tags = new TagCommands(db);
  }

  commitRecord(id: string, entry: unknown, file: FileInfo): Result<ImageWithId, Validation> {
    return this.images.commit(id, entry, file);
  }

  updateRecord(id: string, patch: unknown): Result<ImageWithId, NotFound | StaleUpdate | Validation> {
    return this.images.update(id, patch);
  }

  updateRecordFileMeta(id: string, meta: FileMetaPatch): Result<ImageWithId, NotFound> {
    return this.images.updateFileMeta(id, meta);
  }

  removeRecord(id: string): Result<ImageRecord, NotFound> {
    return this.images.remove(id);
  }

  renameTag(oldName: unknown, newName: unknown): Result<{ affected: number }, Validation> {
    return this.tags.rename(oldName, newName);
  }

  deleteTag(name: unknown): Result<{ affected: number }, LastTag | Validation> {
    return this.tags.delete(name);
  }

  setTagMeta(name: unknown, meta: unknown): Result<void, Validation> {
    return this.tags.setMeta(name, meta);
  }
}
