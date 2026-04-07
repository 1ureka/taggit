import { json, type RequestHandler } from "@sveltejs/kit";

import { requireDatabase } from "$lib/server/db-instance.js";
import { getAllTags } from "$lib/server/db-query.js";
import { renameTag, deleteTag } from "$lib/server/db-mutation.js";

import { parseBody, log } from "$lib/server/helpers.js";
import { isValidTags } from "$lib/server/validation.js";

/**
 * `GET /api/tags`
 *
 * 列出所有標籤及其使用次數，依次數降序排列。
 */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  return json({ ok: true, data: { tags: getAllTags(loaded.db) } });
};

// ---

/**
 * `POST /api/tags`
 *
 * 全域重新命名標籤。
 * Body: `{ oldName, newName }`
 */
export const POST: RequestHandler = async ({ request }) => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const fields = [body.oldName, body.newName];
  if (!isValidTags(fields)) {
    return json({ ok: false, error: "oldName 和 newName 必須是有效且不同的標籤字串" }, { status: 400 });
  }

  const oldName = fields[0].trim();
  const newName = fields[1].trim();

  const affected = renameTag(loaded.db, oldName, newName);
  log({ level: "info", module: "tags", message: `重命名標籤: "${oldName}" → "${newName}"`, data: { affected } });
  return json({ ok: true, data: { affected } });
};

// ---

/**
 * `DELETE /api/tags`
 *
 * 刪除指定標籤，從所有圖片中移除。
 * Body: `{ name }`
 */
export const DELETE: RequestHandler = async ({ request }) => {
  const loaded = requireDatabase();
  if (!loaded) {
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

  const ids = loaded.db.tagIndex.get(name) ?? new Set();
  for (const id of ids) {
    const record = loaded.db.data.images[id];
    if (record && record.tags.length === 1) {
      return json({ ok: false, error: "conflict" }, { status: 409 });
    }
  }

  const affected = deleteTag(loaded.db, name);
  log({ level: "info", module: "tags", message: `刪除標籤: "${name}"`, data: { affected } });
  return json({ ok: true, data: { affected } });
};
