import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Query } from "$lib/query";

/**
 * `GET /api/proto/tags-union-count`
 *
 * 原型專用：一組標籤取聯集後的圖片張數（純讀取）。
 * Query：`tags=<逗號分隔的標籤名稱>`，找不到的標籤視為空集合。
 * 供 /tags 的合併區即時預估張數使用（sources + target 取聯集）。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const raw = url.searchParams.get("tags") ?? "";
  const tags = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const query = new Query(Database.requireLoaded());
  return json({ ok: true, data: { count: query.unionCount(tags) } });
};
