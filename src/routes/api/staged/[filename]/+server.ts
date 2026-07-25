import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { ImageLibrary } from "$lib/image/server";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { Mutation } from "$lib/mutation";

import { isSafeFilename, formatError } from "$lib/utils/shared";
import { parseBody, errorJson, log } from "$lib/utils/server";

const UNLINK_MAX_ATTEMPTS = 5;
const UNLINK_RETRY_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 刪除檔案，遇到 `EBUSY`/`EPERM`（檔案仍被鎖住）時重試數次再放棄。
 * 這類鎖定多半是短暫的（例如防毒軟體、索引服務短暫佔用），重試可自然恢復。
 */
async function unlinkWithRetry(filePath: string): Promise<void> {
  for (let attempt = 1; attempt <= UNLINK_MAX_ATTEMPTS; attempt++) {
    try {
      fs.unlinkSync(filePath);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      const isLocked = code === "EBUSY" || code === "EPERM";
      if (!isLocked || attempt === UNLINK_MAX_ATTEMPTS) throw e;
      await sleep(UNLINK_RETRY_DELAY_MS * attempt);
    }
  }
}

/**
 * `POST /api/staged/[filename]`
 *
 * 將暫存檔案提交至資料庫，也就是為一張圖片新增紀錄。
 * 該檔名已有紀錄時由 `commitRecord` 回 `already_exists`（HTTP 409），不會覆寫。
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded() || !ImageLibrary.isActive()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const mutation = new Mutation(Database.requireLoaded());

  // ---

  const { filename } = params;
  if (!isSafeFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  if (!ImageLibrary.isImageFile(filename)) {
    return json({ ok: false, error: "非圖片檔案" }, { status: 400 });
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
export const DELETE: RequestHandler = async ({ params }) => {
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

  try {
    await unlinkWithRetry(resolved.data);
  } catch (e) {
    log({ level: "error", module: "staged/[id]", message: `刪除暫存失敗: ${filename} (${formatError(e)})` });
    return json({ ok: false, error: "檔案刪除失敗，請稍後再試" }, { status: 500 });
  }

  log({ level: "info", module: "staged/[id]", message: `刪除暫存: ${filename}` });
  return json({ ok: true, data: { filename } });
};
