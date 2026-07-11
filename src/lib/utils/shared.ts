/**
 * @file 前後端共用的通用工具函數。
 *
 * 本檔案僅收錄瀏覽器與 Node.js 環境皆可執行的函數。
 * 若函數依賴僅限於特定環境的 API（例如 DOM、`fs`），
 * 請放置於同資料夾的 `client.ts` 或 `server.ts`。
 */

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

/** 檔名必須非空且不含路徑穿越字元，不涉及 domain validation */
export function isSafeFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..") &&
    !value.startsWith(".")
  );
}
