/**
 * @file formats.ts
 * 圖片格式判斷 —— 支援的副檔名、MIME 類型與尺寸預設。
 */

/**
 * 圖片尺寸預設。
 * - `"sm"`：小型縮圖（最大 512×512 像素）
 * - `"md"`：中型縮圖（最大 1024×1024 像素）
 * - `"xl"`：原始尺寸，不經過縮放直接提供
 */
export type ImageSize = "sm" | "md" | "xl";

/** 支援的圖片副檔名 */
export const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"]);

/** MIME 類型對應表 */
export const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** 檢查 size 查詢參數是否為 sm / md / xl 其中之一。 */
export function isValidSize(value: unknown): value is ImageSize {
  return value === "sm" || value === "md" || value === "xl";
}
