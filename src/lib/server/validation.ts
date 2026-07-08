/**
 * @file validation.ts
 * 共用的伺服器端輸入驗證函式。
 *
 * 提供輕量的型別守衛（type guard），用於 API 端點在處理請求前
 * 驗證使用者提供的路徑、ID、標籤、評分等欄位。
 * 每個函式同時作為 TypeScript 型別收窄（narrowing）使用。
 */

/** 標籤必須為非空陣列，每個元素為修剪後非空、不重複的字串（各最長 50 字元）。 */
export function isValidTags(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  const seen = new Set<string>();
  for (const t of value) {
    if (typeof t !== "string") return false;

    const trimmed = t.trim();
    if (trimmed === "" || trimmed.length > 50 || trimmed.includes(",") || seen.has(trimmed)) return false;

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

/** name 必須為非空字串，長度 ≤ 200 */
export function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}
