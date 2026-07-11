import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/poc/database";
import { Mutation } from "$lib/poc/mutation";

import { isSafeFilename } from "$lib/utils/shared";
import { parseBody, errorJson, log } from "$lib/utils/server";

/**
 * `PATCH /api/committed/[filename]`
 *
 * 更新圖片的標籤、評分或名稱。
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { filename } = params;
  if (!isSafeFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.updateRecord(filename, body);
  if (!r.ok) return errorJson(r.error);

  return json({ ok: true, data: r.data });
};

// ---

/**
 * `DELETE /api/committed/[filename]`
 *
 * 取消提交，僅移除資料庫記錄，檔案保留於 images/ 並回到 staged 狀態。
 */
export const DELETE: RequestHandler = ({ params }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { filename } = params;
  if (!isSafeFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.removeRecord(filename);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "committed/[id]", message: `取消提交: ${filename}` });
  return json({ ok: true, data: { filename } });
};
