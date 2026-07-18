import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery } from "$lib/query-spec";

/**
 * `GET /api/proto/committed-query`
 *
 * 原型專用：通用的已提交圖片查詢，吃 {@link ImageQuery} 的全部 URL 參數
 * （篩選、排序與分頁），回傳 `{ items, total }`。
 * 目前供 /tags 的標籤懸停預覽圖使用（`includedTags=<tag>&limit=4`，
 * 排序沿用預設 rating desc）；hidden 標籤因 includedTags 豁免規則不會被遮蔽。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const query = new Query(Database.requireLoaded());
  const result = query.images(ImageQuery.fromSearchParams(url.searchParams));
  return json({ ok: true, data: result });
};
