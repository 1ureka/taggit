/**
 * @file validator.ts
 * 實際操作執行前的的驗證工具
 */

export class Validator {
  /** 標籤必須為非空陣列，每個元素為修剪後非空、不重複的字串（各最長 50 字元）。 */
  static tags(value: unknown): value is string[] {
    if (!Array.isArray(value) || value.length === 0) return false;
    const seen = new Set<string>();
    for (const t of value) {
      if (!Validator.tagName(t)) return false;
      const trimmed = t.trim();
      if (seen.has(trimmed)) return false;
      seen.add(trimmed);
    }
    return true;
  }

  /** 評分必須為 [0, 5] 之間的整數。 */
  static rating(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
  }

  /** 圖片名稱必須為非空字串，長度 ≤ 200。 */
  static name(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
  }

  /** 標籤名必須修剪後非空、≤ 50 字元、不含逗號。 */
  static tagName(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 50 && !value.includes(",");
  }
}
