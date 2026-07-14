/**
 * @file serialization.ts
 * db.json 的序列化 + 稀疏處理。
 */

import { isRecord } from "$lib/utils/shared";
import { log } from "$lib/utils/server";
import type { DBData, ImageRecord, TagMeta } from "./types";

/** 目前的資料庫結構版本（寫出時使用）。局部常數，不匯出。 */
const DB_VERSION = 2;

/**
 * tagMeta 的稀疏儲存處理
 */
export class TagMetaCodec {
  /** 標籤元資料的預設值。 */
  static readonly DEFAULT: TagMeta = { hidden: false };

  /** 稀疏 → 完整：以預設值補齊缺席欄位（缺席鍵等同全預設）。 */
  static hydrate(sparse: Partial<TagMeta> | undefined): TagMeta {
    return { ...TagMetaCodec.DEFAULT, ...sparse };
  }

  /** 完整 → 稀疏：剔除等於預設值的欄位；全為預設時回 `null`。 */
  static prune(meta: TagMeta): Partial<TagMeta> | null {
    const pruned: Partial<TagMeta> = {};
    if (meta.hidden === true) pruned.hidden = true;
    return Object.keys(pruned).length > 0 ? pruned : null;
  }
}

/** 回傳空的資料庫內容（載入失敗 / 檔案不存在時的起始狀態）。 */
export function emptyDBData(): DBData {
  return { version: DB_VERSION, images: {}, tags: {} };
}

/**
 * 解析原始 `images` 欄位，確保結構與型別正確；無效的個別紀錄逐筆跳過並記 warn（寬容）。
 */
function parseImages(raw: unknown): Record<string, ImageRecord> {
  if (!isRecord(raw)) {
    log({ level: "warn", module: "database", message: "images 欄位格式無效，重置為空資料庫" });
    return {};
  }

  const result: Record<string, ImageRecord> = {};
  let skipped = 0;

  for (const [id, record] of Object.entries(raw)) {
    if (!isRecord(record)) {
      skipped++;
      continue;
    }

    if (
      typeof record.name === "string" &&
      typeof record.rating === "number" &&
      typeof record.committedAt === "number" &&
      typeof record.updatedAt === "number" &&
      typeof record.fileSize === "number" &&
      typeof record.width === "number" &&
      typeof record.height === "number" &&
      typeof record.blurhash === "string" &&
      Array.isArray(record.tags) &&
      record.tags.every((t) => typeof t === "string")
    ) {
      result[id] = {
        name: record.name,
        tags: record.tags,
        rating: record.rating,
        committedAt: record.committedAt,
        updatedAt: record.updatedAt,
        fileSize: record.fileSize,
        width: record.width,
        height: record.height,
        blurhash: record.blurhash,
      };
    } else {
      log({ level: "warn", module: "database", message: `images["${id}"] 欄位格式有誤，已跳過` });
      skipped++;
    }
  }

  if (skipped > 0) {
    log({ level: "warn", module: "database", message: `共跳過 ${skipped} 筆無效記錄` });
  }

  return result;
}

/**
 * 解析 `tags` 元資料欄位（v2）。欄位缺失（v1）或格式無效時回空表；只保留非預設值（維持稀疏）。
 */
function parseTagsMeta(raw: unknown): Record<string, Partial<TagMeta>> {
  if (raw === undefined) return {};

  if (!isRecord(raw)) {
    log({ level: "warn", module: "database", message: "tags 欄位格式無效，以空表載入" });
    return {};
  }

  const result: Record<string, Partial<TagMeta>> = {};

  for (const [name, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      log({ level: "warn", module: "database", message: `tags["${name}"] 欄位格式有誤，已跳過` });
      continue;
    }

    const hydrated = TagMetaCodec.hydrate({ hidden: typeof value.hidden === "boolean" ? value.hidden : undefined });
    const pruned = TagMetaCodec.prune(hydrated);
    if (pruned) result[name] = pruned;
  }

  return result;
}

/**
 * 解析整份 db.json 內容（v1 或 v2）。呼叫端負責檔案讀取與例外處理；本函式只處理已解析的 JSON 值。
 */
export function parseDBData(parsed: unknown): DBData {
  if (!isRecord(parsed)) return emptyDBData();

  return {
    version: DB_VERSION,
    images: parseImages(parsed.images),
    tags: parseTagsMeta(parsed.tags),
  };
}
