import { json, type RequestHandler } from "@sveltejs/kit";

import * as database from "$lib/database/server.js";

import { parseBody, log } from "$lib/server/helpers.js";

/**
 * `POST /api/tags`
 *
 * 全域重新命名標籤。
 * Body: `{ oldName, newName }`
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const fields = [body.oldName, body.newName];
  if (!database.isValidTags(fields)) {
    return json({ ok: false, error: "oldName 和 newName 必須是有效且不同的標籤字串" }, { status: 400 });
  }

  const oldName = fields[0].trim();
  const newName = fields[1].trim();

  const affected = database.renameTag(oldName, newName);
  log({ level: "info", module: "tags", message: `重命名標籤: "${oldName}" → "${newName}"`, data: { affected } });
  return json({ ok: true, data: { affected } });
};

// ---

/**
 * `DELETE /api/tags`
 *
 * 刪除指定標籤，從所有圖片中移除（含標籤元資料）。
 * 若有圖片會因此失去最後一個標籤，回應 409。
 * Body: `{ name }`
 */
export const DELETE: RequestHandler = async ({ request }) => {
  if (!database.isLoaded()) {
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

  try {
    const affected = database.deleteTag(name);
    log({ level: "info", module: "tags", message: `刪除標籤: "${name}"`, data: { affected } });
    return json({ ok: true, data: { affected } });
  } catch (e) {
    if (e instanceof Error && "status" in e && e.status === 409) {
      return json({ ok: false, error: "conflict" }, { status: 409 });
    }
    throw e;
  }
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
  if (!database.isLoaded()) {
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

  database.setTagMeta(name, { hidden: body.hidden });
  log({ level: "info", module: "tags", message: `設定標籤元資料: "${name}"`, data: { hidden: body.hidden } });
  return json({ ok: true, data: { name, ...database.getTagMeta(name) } });
};
