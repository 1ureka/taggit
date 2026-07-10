import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/poc/database";
import { Mutation } from "$lib/poc/mutation";

import { parseBody, errorJson, log } from "$lib/utils/server";

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

// ---

/**
 * `DELETE /api/tags`
 *
 * 刪除指定標籤，從所有圖片中移除（含標籤元資料）。
 * 若有圖片會因此失去最後一個標籤，回應 409（`last_tag`，帶受影響的 id 列表）。
 */
export const DELETE: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.deleteTag(body.name);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags", message: `刪除標籤: "${body.name}"`, data: r.data });
  return json({ ok: true, data: r.data });
};

// ---

/**
 * `PATCH /api/tags`
 *
 * 設定標籤本身的元資料，元資料獨立於標籤的使用狀態存在，允許為目前未使用的標籤名稱設定。
 */
export const PATCH: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.setTagMeta(body.name, { hidden: body.hidden });
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags", message: `設定標籤元資料: "${body.name}"`, data: { hidden: body.hidden } });
  return json({ ok: true, data: { name: body.name, hidden: body.hidden } });
};
