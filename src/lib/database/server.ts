/**
 * @file database/server.ts
 * database 模組的 server 端入口 —— 單例管理與全部公開介面。
 *
 * 職責：在給定的 db.json 檔案下，處理 JSON ↔ 記憶體元資料的管理
 * （查詢、新增、修改、持久化）與溝通（查詢參數解析）。
 * 它不在意 id 是不是檔名、實際圖片存不存在；只要求 id 在同一 collection 內唯一。
 *
 * 查詢介面直接接受 `URLSearchParams`，內部自行解析；
 * 需要在 page load 覆寫選項時（如 compare 的隨機兩張），以第二參數傳入 overrides。
 *
 * 模組外部只能 import 本檔與 {@link ./client.ts}。
 */

import { Database } from "./internal/store.js";
import * as query from "./internal/query.js";
import * as mutation from "./internal/mutation.js";
import { parseQueryParams, parseTagQueryParams } from "./internal/params.js";
import type { FileInfo, ImageRecord, ImageWithId, ImportEntry, QueryOptions } from "./internal/types.js";
import type { QueryResult, TagFacet, TagMeta, TagQueryOptions, TagQueryResult, UpdatePatch } from "./internal/types.js";

export { isValidName, isValidTags, isValidRating } from "./internal/schema.js";
export type {
  DBData,
  FileInfo,
  ImageRecord,
  ImageWithId,
  ImportEntry,
  QueryOptions,
  QueryResult,
  SortField,
  TagFacet,
  TagImageSample,
  TagInfo,
  TagMeta,
  TagQueryOptions,
  TagQueryResult,
  TagSampleMode,
  TagSortField,
  TagWithSamples,
  UpdatePatch,
} from "./internal/types.js";

// ---

declare global {
  /** HMR 保護：在熱重載之間重用現有的 {@link Database} 實例。 */
  var __db: Database | undefined;
}

/**
 * 回傳模組層級的 {@link Database} 單例，首次存取時建立。
 * 實例儲存於 `globalThis`，使 Vite HMR 不會在重載間重設它。
 */
function getDB(): Database {
  if (!globalThis.__db) {
    globalThis.__db = new Database();
  }
  return globalThis.__db;
}

/**
 * 取得已載入的資料庫實例；未載入時擲出帶 `status: 503` 的錯誤。
 * 公開介面內部使用 —— API 層應先以 {@link isLoaded} 判斷並回應 503。
 */
function requireLoaded(): Database {
  const db = getDB();
  if (!db.isLoaded()) {
    throw Object.assign(new Error("尚未載入資料庫"), { status: 503 });
  }
  return db;
}

// ---

/**
 * 確保資料庫已載入指定的 db.json：
 * 未載入或目前載入的是其他檔案時載入，否則為 no-op。
 */
export function ensureLoaded(dbPath: string): void {
  const db = getDB();
  if (!db.isLoaded() || db.currentDbPath !== dbPath) {
    db.loadCollection(dbPath);
  }
}

/**
 * 資料庫是否已載入且可供查詢。
 */
export function isLoaded(): boolean {
  return getDB().isLoaded();
}

/**
 * 目前載入的 db.json 絕對路徑，未載入時為 `null`。
 */
export function currentDbPath(): string | null {
  return getDB().currentDbPath;
}

/**
 * 立即將所有待處理的變更寫入磁碟。
 * 未載入或無變更時為安全的空操作（供 hooks 的訊號處理與備份前使用）。
 */
export function flush(): void {
  getDB().flush();
}

// ---

/**
 * 統一圖片查詢：篩選 + hidden 遮蔽 + 排序 + 分頁 + facet 計數。
 *
 * @param params - URL 的 searchParams，由本模組自行解析。
 * @param overrides - 覆寫解析結果的查詢選項（page load 特化用）。
 */
export function queryImages(params: URLSearchParams, overrides?: Partial<QueryOptions>): QueryResult {
  const opts = { ...parseQueryParams(params), ...overrides };
  return query.queryImages(requireLoaded(), opts);
}

/**
 * 統一標籤查詢：篩選 + 排序 + 分頁 + 樣本圖片。
 *
 * @param params - URL 的 searchParams，由本模組自行解析。
 * @param overrides - 覆寫解析結果的查詢選項（page load 特化用）。
 */
export function queryTags(params: URLSearchParams, overrides?: Partial<TagQueryOptions>): TagQueryResult {
  const opts = { ...parseTagQueryParams(params), ...overrides };
  return query.queryTags(requireLoaded(), opts);
}

/**
 * 全庫（不帶任何篩選）的標籤 facet 計數。
 * 供無查詢語境的頁面（tagger、settings）的自動完成使用。
 */
export function getAllTagFacets(): TagFacet[] {
  return query.getAllTagFacets(requireLoaded());
}

/**
 * 取得單張圖片（含 id），找不到回傳 `null`。
 */
export function getImage(id: string): ImageWithId | null {
  return query.getImageRecord(requireLoaded(), id);
}

/**
 * 檢查資料庫是否存在指定 id。
 */
export function hasImage(id: string): boolean {
  return query.hasImage(requireLoaded(), id);
}

/**
 * 已提交圖片的總數。
 */
export function getImageCount(): number {
  return query.getImageCount(requireLoaded());
}

/**
 * 回傳全部圖片紀錄（含 id），不套用任何篩選與 hidden 遮蔽。
 * 僅供維護用途（missing / metadata 掃描）使用。
 */
export function getAllImages(): ImageWithId[] {
  return query.getAllImages(requireLoaded());
}

// ---

/**
 * 提交（或覆寫）一筆圖片紀錄。
 * 檔案側元資料由呼叫端（route 層）向 image 模組取得後傳入。
 */
export function commitImage(id: string, entry: ImportEntry, file: FileInfo): ImageWithId {
  return mutation.commitRecord(requireLoaded(), id, entry, file);
}

/**
 * 使用樂觀併發檢查更新圖片的標籤、評分或名稱。
 * 404 / 409 以帶 `status` 的錯誤擲出。
 */
export function updateImage(id: string, patch: UpdatePatch): ImageWithId {
  return mutation.updateRecord(requireLoaded(), id, patch);
}

/**
 * 更新圖片的檔案側元資料（尺寸、blurhash），不經樂觀併發檢查。
 * 僅供維護用途使用。
 */
export function updateImageFileMeta(
  id: string,
  meta: Partial<Pick<ImageRecord, "width" | "height" | "blurhash">>,
): ImageWithId {
  return mutation.updateRecordFileMeta(requireLoaded(), id, meta);
}

/**
 * 移除圖片紀錄並回傳。404 以帶 `status` 的錯誤擲出。
 */
export function removeImage(id: string): ImageRecord {
  return mutation.removeRecord(requireLoaded(), id);
}

// ---

/**
 * 全域重新命名標籤（含元資料搬移）。回傳受影響的圖片數。
 */
export function renameTag(oldName: string, newName: string): number {
  return mutation.renameTag(requireLoaded(), oldName, newName);
}

/**
 * 全域刪除標籤（含元資料）。回傳受影響的圖片數。
 * 若有圖片會因此失去最後一個標籤，以帶 `status: 409` 的錯誤擲出。
 */
export function deleteTag(name: string): number {
  return mutation.deleteTag(requireLoaded(), name);
}

/**
 * 合併寫入標籤元資料（如 `hidden`）。
 */
export function setTagMeta(name: string, meta: Partial<TagMeta>): void {
  mutation.setTagMeta(requireLoaded(), name, meta);
}

/**
 * 讀取標籤元資料，補齊預設值後回傳。
 */
export function getTagMeta(name: string): TagMeta {
  return mutation.getTagMeta(requireLoaded(), name);
}
