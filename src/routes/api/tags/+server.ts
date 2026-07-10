import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/poc/database";
import { Mutation } from "$lib/poc/mutation";

import { parseBody, errorJson, log } from "$lib/utils/server.js";

/**
 * `POST /api/tags`
 *
 * 全域重新命名標籤。
 * Body: `{ oldName, newName }`
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  if (typeof body.oldName !== "string" || typeof body.newName !== "string") {
    return json({ ok: false, error: "oldName 和 newName 必須是字串" }, { status: 400 });
  }

  const oldName = body.oldName.trim();
  const newName = body.newName.trim();

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.renameTag(oldName, newName);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags", message: `重命名標籤: "${oldName}" → "${newName}"`, data: r.data });
  return json({ ok: true, data: r.data });
};

// ---

/**
 * `DELETE /api/tags`
 *
 * 刪除指定標籤，從所有圖片中移除（含標籤元資料）。
 * 若有圖片會因此失去最後一個標籤，回應 409（`last_tag`，帶受影響的 id 列表）。
 * Body: `{ name }`
 */
export const DELETE: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return json({ ok: false, error: "name 必須是非空字串" }, { status: 400 });
  }

  const name = body.name.trim();

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.deleteTag(name);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags", message: `刪除標籤: "${name}"`, data: r.data });
  return json({ ok: true, data: r.data });
};

// ---

/**
 * `PATCH /api/tags`
 *
 * 設定標籤本身的元資料（目前僅 `hidden`）。
 * 元資料獨立於標籤的使用狀態存在，允許為目前未使用的標籤名稱設定。
 * Body: `{ name, hidden }`
 */
export const PATCH: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return json({ ok: false, error: "name 必須是非空字串" }, { status: 400 });
  }

  if (typeof body.hidden !== "boolean") {
    return json({ ok: false, error: "hidden 必須是布林值" }, { status: 400 });
  }

  const name = body.name.trim();
  const hidden = body.hidden;

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.setTagMeta(name, { hidden });
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags", message: `設定標籤元資料: "${name}"`, data: { hidden } });
  return json({ ok: true, data: { name, hidden } });
};
