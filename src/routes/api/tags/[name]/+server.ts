import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Mutation } from "$lib/mutation";
import { Query } from "$lib/query";
import { TagQuery, TagWhere } from "$lib/query-spec";

import { parseJsonObject, throwMutationError, log } from "$lib/utils/server";

/**
 * 取單一標籤目前的表示；位元圖與元資料都沒有時代表這個標籤不存在。
 * `TagWhere.name` 是子字串比對，只用來縮小掃描範圍，仍需自行取完全相等的那一筆。
 */
function lookup(query: Query, name: string) {
  const { items } = query.tags(new TagQuery(new TagWhere({ name, universe: "all" })));
  return items.find((t) => t.name === name) ?? null;
}

/**
 * `GET /api/tags/[name]`
 *
 * 取得單一標籤（含全域使用數與元資料）。
 */
export const GET: RequestHandler = ({ params }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const query = new Query(Database.requireLoaded());
  const tag = lookup(query, params.name!);
  if (!tag) error(404, "找不到目標標籤");

  return json(tag);
};

/**
 * `PATCH /api/tags/[name]`
 *
 * 改名與／或覆寫顯隱。兩者皆給時先改名，再對改名後的名稱設定顯隱。
 * Body: `{ name?: string, hidden?: boolean }`
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const name = params.name!;
  const body = await parseJsonObject(request);
  if (body.name === undefined && body.hidden === undefined) error(400, "未指定任何異動");

  const db = Database.requireLoaded();
  const mutation = new Mutation(db);

  // 走批次入口以共用同一份順序與驗證規則，成員層只是「一個鍵的批次」
  const applied = mutation.applyTagChanges({ [name]: body });
  const r = applied[name];
  if (!r.ok) throwMutationError(r.error);

  const finalName = typeof body.name === "string" ? body.name.trim() : name;
  const tag = lookup(new Query(db), finalName);
  if (!tag) error(404, "找不到目標標籤");

  log({ level: "info", module: "tags/[name]", message: `更新標籤: "${name}" → "${finalName}"` });
  return json(tag);
};

/**
 * `DELETE /api/tags/[name]`
 *
 * 從所有圖片中移除該標籤，並刪除其元資料。
 * 若有圖片會因此失去最後一個標籤則回 409。
 */
export const DELETE: RequestHandler = ({ params }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const name = params.name!;
  const mutation = new Mutation(Database.requireLoaded());

  const r = mutation.deleteTag(name);
  if (!r.ok) throwMutationError(r.error);

  log({ level: "info", module: "tags/[name]", message: `刪除標籤: "${name}"`, data: r.data });
  return json({ name, affected: r.data.affected });
};
