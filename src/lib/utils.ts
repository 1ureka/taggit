import type { QueryOptions } from "$lib/types.js";

/**
 * 解析以逗號分隔的標籤字串。
 * 回傳裁切空白後的非空標籤陣列。
 */
export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 從 URL 的 searchParams 中提取 {@link QueryOptions}。
 * 處理 tags、rating、ratingOp、sort、order、page、limit。
 */
export function parseQueryParams(url: URL): QueryOptions {
  const p = url.searchParams;
  return {
    search: p.get("search") ?? undefined,
    tags: parseTags(p.get("tags")),
    rating: p.has("rating") ? Number(p.get("rating")) : undefined,
    ratingOp: (p.get("ratingOp") as "gte" | "lte" | "eq") ?? "gte",
    sort: (p.get("sort") as "committedAt" | "rating" | "name" | "random") ?? "committedAt",
    order: (p.get("order") as "asc" | "desc") ?? "desc",
    page: p.has("page") ? Number(p.get("page")) : undefined,
    limit: p.has("limit") ? Number(p.get("limit")) : undefined,
  };
}

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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

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
