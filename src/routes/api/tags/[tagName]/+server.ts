import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/poc/database";
import { Mutation } from "$lib/poc/mutation";

import { parseBody, errorJson, log } from "$lib/utils/server";

/**
 * `DELETE /api/tags/[tagName]`
 *
 * 刪除指定標籤，從所有圖片中移除（含標籤元資料）。
 * 若有圖片會因此失去最後一個標籤，回應 409（`last_tag`，帶受影響的 id 列表）。
 */
export const DELETE: RequestHandler = ({ params }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { tagName } = params;

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.deleteTag(tagName);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags/[name]", message: `刪除標籤: "${tagName}"`, data: r.data });
  return json({ ok: true, data: r.data });
};

// ---

/**
 * `PATCH /api/tags/[tagName]`
 *
 * 設定標籤本身的元資料，元資料獨立於標籤的使用狀態存在，允許為目前未使用的標籤名稱設定。
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { tagName } = params;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.setTagMeta(tagName, { hidden: body.hidden });
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags/[name]", message: `設定標籤元資料: "${tagName}"`, data: { hidden: body.hidden } });
  return json({ ok: true, data: { name: tagName, hidden: body.hidden } });
};
