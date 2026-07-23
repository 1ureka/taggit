import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Query } from "$lib/query";

/**
 * `GET /api/proto/tags-impact`
 *
 * 原型專用：查詢一組指定標籤名稱目前個別的全域使用數（純讀取，不受篩選/遮蔽影響）。
 * Query：`names=<逗號分隔的標籤名稱>`，找不到的標籤 count 為 0。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const names = (url.searchParams.get("names") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const query = new Query(Database.requireLoaded());
  return json({ ok: true, data: { counts: query.tagCounts(names) } });
};
