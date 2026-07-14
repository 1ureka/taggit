import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { ImageLibrary } from "$lib/image/server";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { Mutation } from "$lib/mutation";

import { isSafeFilename } from "$lib/utils/shared";
import { parseBody, errorJson, log } from "$lib/utils/server";

/**
 * `POST /api/staged/[filename]`
 *
 * 將暫存檔案提交至資料庫，也就是為一張圖片新增紀錄。
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded() || !ImageLibrary.isActive()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const db = Database.requireLoaded();
  const query = new Query(db);
  const mutation = new Mutation(db);

  // ---

  const { filename } = params;
  if (!isSafeFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  if (!ImageLibrary.isImageFile(filename)) {
    return json({ ok: false, error: "非圖片檔案" }, { status: 400 });
  }

  if (query.hasImage(filename)) {
    return json({ ok: false, error: "已提交的圖片" }, { status: 409 });
  }

  if (!ImageLibrary.has(filename)) {
    return json({ ok: false, error: "檔案不存在" }, { status: 404 });
  }

  // ---

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { tags, rating, name } = body;

  // name 為可選；未提供時沿用去副檔名的檔名（向後相容匯入等既有呼叫）
  const ext = path.extname(filename).toLowerCase();
  const resolvedName =
    name === undefined ? path.basename(filename, ext) : typeof name === "string" ? name.trim() : name;

  // ---

  const probed = await ImageLibrary.probe(filename);
  if (!probed.ok) {
    return json({ ok: false, error: "檔案不存在" }, { status: 404 });
  }

  const r = mutation.commitRecord(filename, { name: resolvedName, tags, rating }, probed.data);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "staged/[id]", message: `提交成功: ${filename}` });
  return json({ ok: true, data: r.data }, { status: 201 });
};

// ---

/**
 * `DELETE /api/staged/[filename]`
 *
 * 永久刪除暫存區中的指定檔案。
 */
export const DELETE: RequestHandler = ({ params }) => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded() || !ImageLibrary.isActive()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const query = new Query(Database.requireLoaded());

  const { filename } = params;
  if (!isSafeFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  if (query.hasImage(filename)) {
    return json({ ok: false, error: "無法透過暫存區端點刪除已提交的圖片" }, { status: 409 });
  }

  const resolved = ImageLibrary.resolve(filename);
  if (!resolved.ok) {
    return json({ ok: false, error: "檔案不存在" }, { status: 404 });
  }

  fs.unlinkSync(resolved.data);
  log({ level: "info", module: "staged/[id]", message: `刪除暫存: ${filename}` });
  return json({ ok: true, data: { filename } });
};
