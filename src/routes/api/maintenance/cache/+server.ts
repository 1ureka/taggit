import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { clearCache, getCacheStats } from "$lib/server/thumbnail.js";

/** GET /api/maintenance/cache — 取得快取統計資訊 */
export const GET: RequestHandler = () => {
  return json({ ok: true, data: getCacheStats() });
};

/** DELETE /api/maintenance/cache — 清空記憶體中的圖片快取 */
export const DELETE: RequestHandler = () => {
  clearCache();
  return json({ ok: true });
};
