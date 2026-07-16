import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { TagQuery } from "$lib/query-spec";

/**
 * `GET /api/proto/tags-query`
 *
 * 原型專用：獨立標籤列表查詢（standalone 語意——count 為原始總使用數、
 * 不經 hidden 遮蔽、`universe=all` 可含 count 0 的 meta-only 標籤），
 * 吃 {@link TagQuery} 的全部 URL 參數（name 子字串、hidden、universe、排序與分頁）。
 * 供 /tags 標籤池的伺服器分頁使用；`GET /api/tags`（facet 語意）不適用於管理情境。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const query = new Query(Database.requireLoaded());
  const result = query.tags(TagQuery.fromSearchParams(url.searchParams));
  return json({ ok: true, data: result });
};
