import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { parseJsonObject } from "$lib/utils/server";

/**
 * `POST /api/tags/counts`
 *
 * 一組標籤的計數摘要，只回數字：
 * - `counts`：每個標籤各自的全域使用數（未篩選、未遮蔽），不存在的標籤為 0
 * - `union`：這些標籤取聯集後的圖片張數
 *
 * Body: `{ names: string[] }`
 *
 * 走 POST 而非 GET 是因為名稱可能上百個，塞不進 URL——Node 預設的 header 上限會先爆掉。
 *
 * 已知取捨：這是靜態路由，會遮蔽名字剛好叫 `counts` 的標籤在 `/api/tags/[name]` 上的存取；
 * 那三支成員端點只為對稱存在，沒有前端使用。
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const body = await parseJsonObject(request);
  if (!Array.isArray(body.names)) error(400, "names 必須是陣列");

  const names = body.names.filter((n): n is string => typeof n === "string" && n.trim().length > 0).map((n) => n.trim());

  const query = new Query(Database.requireLoaded());

  const counts: Record<string, number> = {};
  for (const { name, count } of query.tagCounts(names)) counts[name] = count;

  return json({ counts, union: query.unionCount(names) });
};
