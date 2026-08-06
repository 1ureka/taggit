/**
 * @file image/client.ts
 * image 模組的 client 端入口。
 *
 * 模組外部只能 import 本檔與 {@link ./server.ts}。
 */

import type { ImageSize } from "./formats";
import { blurhashStyle } from "./blurhash";

export type { ImageSize };
export { blurhashStyle };

/**
 * 構建 `/api/files/{name}` 的圖片 URL，自動處理 URL 編碼與尺寸參數。
 *
 * 走 files 而非 records：這裡要的是磁碟上那個檔案的二進位內容，與它有沒有紀錄無關，
 * 因此暫存區與已提交的圖片共用同一組 URL。
 *
 * `animated` 為 true 時附加 `animated=1`，讓後端在縮圖時保留多幀動畫（如 GIF），
 * 僅需在真正要顯示動畫的呼叫點開啟；`xl`（原圖）本就保留動畫，無需此旗標。
 *
 * @example
 * ```ts
 * const url = imgSrc("一張圖片.jpg", "md");
 * // url 會是 "/api/files/%E4%B8%80%E5%BC%B5%E5%9C%96%E7%89%87.jpg?size=md"
 * ```
 */
export function imgSrc(file: string, size?: ImageSize, animated?: boolean): string {
  const encoded = encodeURIComponent(file);
  const params: string[] = [];
  if (size) params.push(`size=${size}`);
  if (animated) params.push("animated=1");
  const query = params.length ? `?${params.join("&")}` : "";
  return `/api/files/${encoded}${query}`;
}
