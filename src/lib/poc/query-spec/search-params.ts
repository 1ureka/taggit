/**
 * @file search-params.ts
 * URLSearchParams 讀寫純函式（parse + serialize helpers）
 */

/** 解析逗號分隔標籤字串為裁切後的非空陣列。 */
export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 字串轉有限整數，無效回 `undefined`（避免 NaN 污染下游）。 */
export function safeInt(raw: string | null): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/** 若 `raw` 屬於 `allowed` 則回傳（收窄型別），否則回 `undefined`。 */
export function parseEnum<T extends string>(raw: string | null, allowed: readonly T[]): T | undefined {
  return raw != null && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

/** 字串轉布林，只接受 `"true"` / `"false"`，其餘回 `undefined`。 */
export function parseBool(raw: string | null): boolean | undefined {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

/**
 * 初始化一個全新的 `URLSearchParams`。
 * - 若傳入 `base` 則會進行深拷貝並刪除 `keys` 指定的鍵。
 * - 若未傳入 `base`，則直接回傳一個乾淨的空 `URLSearchParams`。
 */
export function buildSearchParams(base: URLSearchParams | undefined, keys: readonly string[]): URLSearchParams {
  const p = new URLSearchParams(base);
  keys.forEach((k) => p.delete(k));
  return p;
}
