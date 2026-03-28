import { json, type RequestHandler } from "@sveltejs/kit";
import { requireDatabase } from "$lib/server/db-instance.js";
import { queryImages } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";

/**
 * `GET /api/committed`
 *
 * 查詢已提交圖片，支援篩選與分頁。
 */
export const GET: RequestHandler = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  return json({ ok: true, data: queryImages(loaded.db, parseQueryParams(url)) });
};
