import { json, type RequestHandler } from "@sveltejs/kit";
import { ImageLibrary } from "$lib/image/server";

/**
 * `GET /api/settings/cache`
 *
 * 取得快取統計資訊。
 */
export const GET: RequestHandler = () => {
  return json({ ok: true, data: ImageLibrary.stats() });
};

// ---

/**
 * `DELETE /api/settings/cache`
 *
 * 清空記憶體中的圖片快取。
 */
export const DELETE: RequestHandler = () => {
  const cleared = ImageLibrary.clear();
  return json({ ok: true, data: { cleared } });
};
