/**
 * @file schema.ts
 * db.json 的解析與驗證 —— v1 / v2 皆可讀，寫出固定為 v2。
 *
 * 相容性策略：
 * - `images` 區塊的結構與 v1 完全相同。
 * - `tags` 為 v2 新增的稀疏元資料表；v1 檔案（或欄位缺失 / 無效）載入為空表。
 * - 純讀取永不觸發改寫；首次異動後的寫出即為 v2。
 */

import { isRecord } from "$lib/utils.js";
import { log } from "$lib/server/helpers.js";
import type { DBData, ImageRecord, TagMeta } from "./types.js";

/** 目前的資料庫結構版本（寫出時使用）。 */
export const DB_VERSION = 2;

/** 標籤元資料的預設值。 */
export const DEFAULT_TAG_META: TagMeta = { hidden: false };

/**
 * 回傳空的資料庫內容（載入失敗 / 檔案不存在時的起始狀態）。
 */
export function emptyDBData(): DBData {
  return { version: DB_VERSION, images: {}, tags: {} };
}

/**
 * 解析從 db.json 讀取的原始 `images` 欄位資料，確保其結構與類型正確。
 * 無效的個別紀錄逐筆跳過並記 warn 日誌。
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
 * 解析 `tags` 元資料欄位（v2）。
 * 欄位缺失（v1）或格式無效時回傳空表；只保留非預設值的項目（維持稀疏）。
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

    const meta = pruneTagMeta({ hidden: typeof value.hidden === "boolean" ? value.hidden : undefined });
    if (meta) result[name] = meta;
  }

  return result;
}

/**
 * 剔除等於預設值的欄位；全為預設時回傳 `null`（該表項應被移除）。
 */
export function pruneTagMeta(meta: Partial<TagMeta>): Partial<TagMeta> | null {
  const pruned: Partial<TagMeta> = {};
  if (meta.hidden === true) pruned.hidden = true;
  return Object.keys(pruned).length > 0 ? pruned : null;
}

/**
 * 解析整份 db.json 內容（v1 或 v2）。
 * 呼叫端負責檔案讀取與例外處理；本函式只處理已解析的 JSON 值。
 */
export function parseDBData(parsed: unknown): DBData {
  if (!isRecord(parsed)) return emptyDBData();

  return {
    version: DB_VERSION,
    images: parseImages(parsed.images),
    tags: parseTagsMeta(parsed.tags),
  };
}
