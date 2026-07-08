/**
 * @file image/server.ts
 * image 模組的 server 端入口。
 *
 * 職責：在給定的 collection 目錄下，找到圖檔、壓縮、產生檔案側元資料。
 * 它不在意這張圖片在 db.json 有沒有紀錄、怎樣紀錄（那是 database 模組的事）。
 *
 * 模組外部只能 import 本檔與 {@link ./client.ts}。
 */

import fs from "fs";
import path from "path";
import { IMG_EXTS, MIME_TYPES } from "./internal/formats.js";
import { sortCollator } from "$lib/utils/shared.js";

export { getImageBuffer, clearCache, getCacheStats } from "./internal/thumbnail.js";
export { generateMetadata, readImageInfo } from "./internal/metadata.js";
export { isValidSize } from "./internal/formats.js";
export type { ImageSize } from "./internal/formats.js";
export type { FileInfo } from "./internal/metadata.js";

/**
 * 依副檔名判斷是否為支援的圖片檔案。
 */
export function isImageFile(filename: string): boolean {
  return IMG_EXTS.has(path.extname(filename).toLowerCase());
}

/**
 * 依副檔名回傳 MIME 類型，未知副檔名回傳 `application/octet-stream`。
 */
export function mimeTypeOf(filename: string): string {
  return MIME_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

/**
 * 列出目錄中所有支援的圖片檔名，依自然排序。
 * 目錄不可讀時回傳空陣列。
 */
export function listImageFiles(imagesDir: string): string[] {
  try {
    return fs
      .readdirSync(imagesDir)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => sortCollator.compare(a, b));
  } catch {
    return [];
  }
}
