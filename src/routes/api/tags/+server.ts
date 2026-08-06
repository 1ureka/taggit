import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Mutation } from "$lib/mutation";
import { Query } from "$lib/query";
import { ImageWhere, TagQuery, TagFacetQuery } from "$lib/query-spec";

import { parseJsonObject, mutationMessage, log } from "$lib/utils/server";

/** 批次操作中單筆的結果。集合層回應一律是 `{ "<name>": ItemResult }`，鍵與請求完全對齊。 */
type ItemResult = { ok: true } | { ok: false; message: string };

/**
 * `GET /api/tags`
 *
 * 分面標籤查詢。同時吃兩組互不衝突的查詢鍵：
 * - {@link ImageWhere}（search / includedTags / excludedTags / rating / ratingOp）作為 scope，
 *   count 即為該篩選範圍內經 hidden 遮蔽後的可見數；不帶時就是全集的分面計數。
 * - {@link TagQuery}（name / hidden / universe + sort / order / page / limit）篩選與排序標籤本身。
 *
 * 這支一律回分面計數。「全域原始使用數」的語意由 `POST /api/tags/counts` 涵蓋，
 * 不為此再發明查詢參數。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const spec = new TagFacetQuery(
    ImageWhere.fromSearchParams(url.searchParams),
    TagQuery.fromSearchParams(url.searchParams),
  );

  const query = new Query(Database.requireLoaded());
  return json(query.facets(spec));
};

/**
 * `PATCH /api/tags`
 *
 * 批次標籤異動。Body 以標籤名為鍵，因此「同一標籤同時只能有一種操作」由結構保證。
 *
 * Body: `{ "<name>": { name?: string, hidden?: boolean } | null }`
 * - `{ name }` = 改名（指向既有標籤即為合併）
 * - `{ hidden }` = 覆寫顯隱
 * - `null` = 刪除，等同對該成員 `DELETE`
 *
 * 回應: `{ "<name>": { ok } }`
 *
 * 執行順序與集合層規則（改名目標若同時被刪除或改名則該筆失敗）都在
 * {@link Mutation.applyTagChanges} 內，端點只做形狀轉換。
 */
export const PATCH: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const changes = await parseJsonObject(request);
  if (Object.keys(changes).length === 0) error(400, "請求內容不得為空");

  const mutation = new Mutation(Database.requireLoaded());
  const applied = mutation.applyTagChanges(changes);

  const results: Record<string, ItemResult> = {};
  for (const [name, r] of Object.entries(applied)) {
    results[name] = r.ok ? { ok: true } : { ok: false, message: mutationMessage(r.error) };
  }

  const okCount = Object.values(results).filter((r) => r.ok).length;
  log({ level: "info", module: "tags", message: `批次標籤操作: 成功 ${okCount}/${Object.keys(results).length}` });

  return json(results);
};
