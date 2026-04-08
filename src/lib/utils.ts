/**
 * @file 前後端共用的通用工具函數。
 *
 * 本檔案僅收錄瀏覽器與 Node.js 環境皆可執行的函數。
 * 若函數依賴僅限於特定環境的 API（例如 DOM、`fs`），
 * 請放置於 `client/` 或 `server/` 對應目錄。
 */

import type { QueryOptions, SortField } from "$lib/types.js";

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
 * 從 URL 的 searchParams 中提取 {@link QueryOptions}。
 * 處理 tags、rating、ratingOp、sort、order、page、limit。
 */
export function parseQueryParams(url: URL): QueryOptions {
  const p = url.searchParams;
  return {
    search: p.get("search") ?? undefined,
    includedTags: parseTags(p.get("includedTags")),
    excludedTags: parseTags(p.get("excludedTags")),
    rating: safeInt(p.get("rating")),
    ratingOp: (p.get("ratingOp") as "gte" | "lte" | "eq") ?? "gte",
    sort: (p.get("sort") as SortField) ?? "committedAt",
    order: (p.get("order") as "asc" | "desc") ?? "desc",
    page: safeInt(p.get("page")),
    limit: safeInt(p.get("limit")),
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
  if (opts.sort && opts.sort !== "committedAt") params.set("sort", opts.sort);
  if (opts.order && opts.order !== "desc") params.set("order", opts.order);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.limit && opts.limit > 0) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ---

/**
 * 將 Unix 毫秒時間戳格式化為本地日期時間字串。
 */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

/**
 * 將位元組數格式化為可讀的大小字串（B / KB / MB / GB）。
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

/**
 * 將錯誤物件格式化為字串。
 */
export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

// ---

/**
 * 回傳 `fn` 的防抖版本。
 * 在 `ms` 毫秒的靜默期後才會真正執行。
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T;
}

/**
 * 回傳 `fn` 的節流版本。
 * 每 `ms` 毫秒最多執行一次。
 */
export function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

/**
 * 以固定大小的並行批次處理 `items`。
 * 回傳 `[成功數, 失敗數]`。
 */
export async function batchRun<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<{ ok: boolean }>,
): Promise<[ok: number, fail: number]> {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.all(items.slice(i, i + size).map(fn));
    for (const r of results) r.ok ? ok++ : fail++;
  }
  return [ok, fail];
}

// ---

/**
 * 用於自然排序的比較器，支援數字排序與區分大小寫
 */
export const sortCollator = new Intl.Collator(undefined, {
  usage: "sort",
  numeric: true,
  sensitivity: "variant",
});

// ---

/**
 * 檢查物件是否包含特定 key，並縮小其型別範圍
 */
export function hasKey<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

/**
 * 檢查值是否為純物件（非 null、非陣列、原型為 Object.prototype 或 null）
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * 檢查陣列是否為非空，並縮小其型別範圍
 */
export function isNonEmpty<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}
