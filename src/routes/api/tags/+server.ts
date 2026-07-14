import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Mutation } from "$lib/mutation";
import { Query } from "$lib/query";
import { ImageWhere, TagQuery, TagFacetQuery } from "$lib/query-spec";

import { parseBody, errorJson, log } from "$lib/utils/server";

/**
 * `GET /api/tags`
 *
 * 分面標籤查詢：標籤側條件（名稱子字串、universe、排序與分頁）語意見 {@link TagQuery}，
 * 並可同時帶 {@link ImageWhere} 的圖片篩選參數作為 scope——count 為該篩選範圍內
 * 經 hidden 遮蔽後的可見數；不帶 scope 參數時即為全集的分面計數。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const spec = new TagFacetQuery(
    ImageWhere.fromSearchParams(url.searchParams),
    TagQuery.fromSearchParams(url.searchParams),
  );

  const query = new Query(Database.requireLoaded());
  const result = query.facets(spec);
  return json({ ok: true, data: result });
};

/**
 * `POST /api/tags`
 *
 * 全域重新命名標籤。
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.renameTag(body.oldName, body.newName);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags", message: `重命名標籤: "${body.oldName}" → "${body.newName}"`, data: r.data });
  return json({ ok: true, data: r.data });
};
