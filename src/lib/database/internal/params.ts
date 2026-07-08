/**
 * @file params.ts
 * 查詢選項與 URLSearchParams 的互轉 —— 環境中立（瀏覽器與 Node.js 皆可執行）。
 *
 * 這是 database 模組「溝通」職責的一半：
 * server 入口的查詢介面直接吃 `URLSearchParams` 並在內部呼叫本檔解析；
 * client 入口將 build / parse 以前端習慣的形態重新輸出。
 */

import type { QueryOptions, SortField, TagQueryOptions, TagSampleMode, TagSortField } from "./types.js";

/**
 * 解析以逗號分隔的標籤字串。
 * 回傳裁切空白後的非空標籤陣列。
 */
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 將字串轉為有限整數，無效值回傳 undefined（避免 NaN 污染下游邏輯）
 */
function safeInt(raw: string | null): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * QueryOptions 的鍵列表
 */
const queryOptionsKeys: (keyof QueryOptions)[] = [
  "excludedTags",
  "includedTags",
  "order",
  "page",
  "rating",
  "ratingOp",
  "search",
  "sort",
  "limit",
] as const;

/**
 * 從 URLSearchParams 中提取 {@link QueryOptions}。
 * 處理 tags、rating、ratingOp、sort、order、page、limit。
 */
export function parseQueryParams(params: URLSearchParams): QueryOptions {
  return {
    search: params.get("search") ?? undefined,
    includedTags: parseTags(params.get("includedTags")),
    excludedTags: parseTags(params.get("excludedTags")),
    rating: safeInt(params.get("rating")),
    ratingOp: (params.get("ratingOp") as "gte" | "lte" | "eq") ?? "gte",
    sort: (params.get("sort") as SortField) ?? "rating",
    order: (params.get("order") as "asc" | "desc") ?? "desc",
    page: safeInt(params.get("page")),
    limit: safeInt(params.get("limit")),
  };
}

/**
 * 將篩選條件構建為 query string（預設值省略）。為 {@link parseQueryParams} 的反向操作。
 */
export function buildQueryString(opts: QueryOptions, params?: URLSearchParams): string {
  params = params ?? new URLSearchParams();
  queryOptionsKeys.forEach((key) => params.delete(key));
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.includedTags && opts.includedTags.length > 0) params.set("includedTags", opts.includedTags.join(","));
  if (opts.excludedTags && opts.excludedTags.length > 0) params.set("excludedTags", opts.excludedTags.join(","));
  if (opts.rating !== undefined) params.set("rating", String(opts.rating));
  if (opts.ratingOp && opts.ratingOp !== "gte") params.set("ratingOp", opts.ratingOp);
  if (opts.sort && opts.sort !== "rating") params.set("sort", opts.sort);
  if (opts.order && opts.order !== "desc") params.set("order", opts.order);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.limit && opts.limit > 0) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ---

/**
 * TagQueryOptions 的鍵列表
 */
const tagQueryOptionsKeys: (keyof TagQueryOptions)[] = [
  "limit",
  "maxCount",
  "minCount",
  "order",
  "page",
  "sampleLimit",
  "sampleMode",
  "search",
  "sort",
] as const;

const tagSortFields = new Set<TagSortField>(["count", "name", "recent", "random"]);
const tagSampleModes = new Set<TagSampleMode>(["stable", "recent", "random"]);

function safeOrder(raw: string | null): "asc" | "desc" {
  return raw === "asc" || raw === "desc" ? raw : "desc";
}

function safeTagSort(raw: string | null): TagSortField {
  return raw && tagSortFields.has(raw as TagSortField) ? (raw as TagSortField) : "count";
}

function safeTagSampleMode(raw: string | null): TagSampleMode {
  return raw && tagSampleModes.has(raw as TagSampleMode) ? (raw as TagSampleMode) : "stable";
}

/**
 * 從 URLSearchParams 中提取 {@link TagQueryOptions}。
 * 處理 search、minCount、maxCount、sort、order、page、limit、sampleLimit、sampleMode。
 */
export function parseTagQueryParams(params: URLSearchParams): TagQueryOptions {
  return {
    search: params.get("search") ?? undefined,
    minCount: safeInt(params.get("minCount")),
    maxCount: safeInt(params.get("maxCount")),
    sort: safeTagSort(params.get("sort")),
    order: safeOrder(params.get("order")),
    page: safeInt(params.get("page")),
    limit: safeInt(params.get("limit")),
    sampleLimit: safeInt(params.get("sampleLimit")),
    sampleMode: safeTagSampleMode(params.get("sampleMode")),
  };
}

/**
 * 將標籤查詢條件構建為 query string（預設值省略）。為 {@link parseTagQueryParams} 的反向操作。
 */
export function buildTagQueryString(opts: TagQueryOptions, params?: URLSearchParams): string {
  params = params ?? new URLSearchParams();
  tagQueryOptionsKeys.forEach((key) => params.delete(key));
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.minCount !== undefined) params.set("minCount", String(opts.minCount));
  if (opts.maxCount !== undefined) params.set("maxCount", String(opts.maxCount));
  if (opts.sort && opts.sort !== "count") params.set("sort", opts.sort);
  if (opts.order && opts.order !== "desc") params.set("order", opts.order);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.limit && opts.limit > 0) params.set("limit", String(opts.limit));
  if (opts.sampleLimit && opts.sampleLimit > 0) params.set("sampleLimit", String(opts.sampleLimit));
  if (opts.sampleMode && opts.sampleMode !== "stable") params.set("sampleMode", opts.sampleMode);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
