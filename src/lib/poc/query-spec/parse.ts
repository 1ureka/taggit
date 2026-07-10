/**
 * @file parse.ts
 * URLSearchParams 解析的純函式 util（isomorphic，非 class，值物件共用）。
 * 只做「字串 → 值」的中性轉換，不含任何領域預設（預設由各值物件建構時填）。
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
