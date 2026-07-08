/**
 * @file database/client.ts
 * database 模組的 client 端入口。
 *
 * 職責：查詢參數的構建與解析（前端特化包裝）+ 查詢／紀錄型別的 re-export。
 * 前端的大宗用法是「改一個欄位 → 重建 query string → goto」，
 * 本檔即以這個形態輸出 build / parse。
 *
 * 模組外部只能 import 本檔與 {@link ./server.ts}。
 */

import { parseQueryParams as parseFromParams } from "./internal/params.js";
import type { QueryOptions } from "./internal/types.js";

export { buildQueryString } from "./internal/params.js";

export type {
  DBData,
  FileInfo,
  ImageRecord,
  ImageWithId,
  ImportEntry,
  QueryOptions,
  QueryResult,
  SortField,
  Tag,
  TagMeta,
  TagQueryOptions,
  UpdatePatch,
} from "./internal/types.js";

/**
 * 從 URL 中提取 {@link QueryOptions}。
 */
export function parseQueryParams(url: URL): QueryOptions {
  return parseFromParams(url.searchParams);
}
