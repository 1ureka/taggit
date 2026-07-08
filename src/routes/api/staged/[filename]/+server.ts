import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import * as image from "$lib/image/server.js";

import { isValidFilename } from "$lib/utils/shared.js";
import { parseBody, log } from "$lib/utils/server.js";

/**
 * `POST /api/staged/[filename]`
 *
 * 將暫存檔案提交至資料庫。
 * Body: `{ tags, rating }`，filename 來自 URL 路徑參數。
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const root = collection.getActiveRoot();
  if (!root || !database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const paths = collection.getCollectionPaths(root);

  // ---

  const { filename } = params;
  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  if (!image.isImageFile(filename)) {
    return json({ ok: false, error: "非圖片檔案" }, { status: 400 });
  }

  if (database.hasImage(filename)) {
    return json({ ok: false, error: "已提交的圖片" }, { status: 409 });
  }

  const filePath = path.join(paths.images, filename);
  if (!fs.existsSync(filePath)) {
    return json({ ok: false, error: "檔案不存在" }, { status: 404 });
  }

  // ---

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { tags, rating } = body;

  if (!database.isValidTags(tags)) {
    return json({ ok: false, error: "無效的標籤 (必須是非空的唯一且非空字串陣列)" }, { status: 400 });
  }

  if (!database.isValidRating(rating)) {
    return json({ ok: false, error: "無效的評分 (必須是 0 ~ 5 的整數)" }, { status: 400 });
  }

  // ---

  try {
    // route 層組合：image 提供檔案側元資料，database 只收純資料
    const ext = path.extname(filename).toLowerCase();
    const fileInfo = await image.readImageInfo(filePath);
    const record = database.commitImage(filename, { name: path.basename(filename, ext), tags, rating }, fileInfo);

    log({ level: "info", module: "staged/[id]", message: `提交成功: ${filename}` });
    return json({ ok: true, data: record }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") {
      return json({ ok: false, error: "檔案不存在" }, { status: 404 });
    }

    log({ level: "error", module: "staged/[id]", message: `POST 未知錯誤: ${filename}`, data: { error: String(e) } });
    return json({ ok: false, error: "未知的錯誤" }, { status: 500 });
  }
};

// ---

/**
 * `DELETE /api/staged/[filename]`
 *
 * 永久刪除暫存區中的指定檔案。
 */
export const DELETE: RequestHandler = ({ params }) => {
  const root = collection.getActiveRoot();
  if (!root || !database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const paths = collection.getCollectionPaths(root);

  const { filename } = params;
  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  if (database.hasImage(filename)) {
    return json({ ok: false, error: "無法透過暫存區端點刪除已提交的圖片" }, { status: 409 });
  }

  const filePath = path.join(paths.images, filename);
  if (!fs.existsSync(filePath)) {
    return json({ ok: false, error: "檔案不存在" }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  log({ level: "info", module: "staged/[id]", message: `刪除暫存: ${filename}` });
  return json({ ok: true, data: { filename } });
};
