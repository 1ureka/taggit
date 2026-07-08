import { json, type RequestHandler } from "@sveltejs/kit";
import { clearCache, getCacheStats } from "$lib/image/server.js";

/**
 * `GET /api/settings/cache`
 *
 * 取得快取統計資訊。
 */
export const GET: RequestHandler = () => {
  return json({ ok: true, data: getCacheStats() });
};

// ---

/**
 * `DELETE /api/settings/cache`
 *
 * 清空記憶體中的圖片快取。
 */
export const DELETE: RequestHandler = () => {
  const cleared = clearCache();
  return json({ ok: true, data: { cleared } });
};
