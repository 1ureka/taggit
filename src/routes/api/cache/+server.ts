import { json, type RequestHandler } from "@sveltejs/kit";
import { ImageLibrary } from "$lib/image/server";

/**
 * `GET /api/cache`
 *
 * 取得縮圖快取的統計資訊。
 *
 * 快取是 ImageLibrary 單例自己的狀態，未綁定圖片集目錄時讀寫也安全，因此不設就緒守衛。
 */
export const GET: RequestHandler = () => {
  return json(ImageLibrary.stats());
};

/**
 * `DELETE /api/cache`
 *
 * 清空記憶體中的縮圖快取。
 */
export const DELETE: RequestHandler = () => {
  return json({ cleared: ImageLibrary.clear() });
};
