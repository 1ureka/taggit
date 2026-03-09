/**
 * @file validation.ts
 * 共用的伺服器端輸入驗證函式。
 *
 * 提供輕量的型別守衛（type guard），用於 API 端點在處理請求前
 * 驗證使用者提供的路徑、ID、標籤、評分等欄位。
 * 每個函式同時作為 TypeScript 型別收窄（narrowing）使用。
 */

import type { ImageArea, ImageSize } from "$lib/types.js";

/** 16 字元小寫十六進位字串。 */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/.test(value);
}

/** 標籤必須為非空陣列，每個元素為修剪後非空、不重複的字串（各最長 50 字元）。 */
export function isValidTags(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  if (value.some((t) => typeof t !== "string" || t.trim() === "" || t.length > 50)) return false;
  // Check uniqueness on trimmed strings
  const seen = new Set<string>();
  for (const t of value as string[]) {
    const trimmed = t.trim();
    if (seen.has(trimmed)) return false;
    seen.add(trimmed);
  }
  return true;
}

/** 評分必須為 [0, 5] 之間的整數。 */
export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
}

/** 絕對路徑看起來合理（非空字串）。 */
export function isValidAbsPath(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** 檢查 area 參數是否為 committed / staged / trash 其中之一。 */
export function isValidArea(value: unknown): value is ImageArea {
  return value === "committed" || value === "staged" || value === "trash";
}

/** 檔名必須非空且不含路徑穿越字元。 */
export function isValidFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..") &&
    !value.startsWith(".")
  );
}

/** 檢查 size 查詢參數是否為 sm / md / xl 其中之一。 */
export function isValidSize(value: unknown): value is ImageSize {
  return value === "sm" || value === "md" || value === "xl";
}

/** name 必須為非空字串，長度 ≤ 200 */
export function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}
