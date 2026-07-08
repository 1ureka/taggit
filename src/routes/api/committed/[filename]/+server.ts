import { json, type RequestHandler } from "@sveltejs/kit";

import * as database from "$lib/database/server.js";

import { isValidFilename, isValidTags, isValidRating, isValidName } from "$lib/server/validation.js";
import { parseBody, log } from "$lib/server/helpers.js";

/**
 * `PATCH /api/committed/[filename]`
 *
 * 更新圖片的標籤、評分或名稱（支援樂觀併發控制）。
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { filename } = params;
  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  // ---

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { tags, rating, name, expectedUpdatedAt } = body;

  if (typeof expectedUpdatedAt !== "number") {
    return json({ ok: false, error: "無效的預期更新時間" }, { status: 400 });
  }

  if (tags !== undefined && !isValidTags(tags)) {
    return json({ ok: false, error: "無效的標籤 (必須是非空的唯一且非空字串陣列)" }, { status: 400 });
  }

  if (rating !== undefined && !isValidRating(rating)) {
    return json({ ok: false, error: "無效的評分 (必須是 0 ~ 5 的整數)" }, { status: 400 });
  }

  if (name !== undefined && !isValidName(name)) {
    return json({ ok: false, error: "無效的名稱 (必須是非空字串，最多 200 個字元)" }, { status: 400 });
  }

  // ---

  try {
    const updated = database.updateImage(filename, { expectedUpdatedAt, tags, rating, name });

    return json({ ok: true, data: updated });
  } catch (e) {
    if (e instanceof Error && "status" in e && typeof e.status === "number") {
      return json({ ok: false, error: e.message }, { status: e.status });
    }

    log({
      level: "error",
      module: "committed/[id]",
      message: `PATCH 未知錯誤: ${filename}`,
      data: { error: String(e) },
    });

    return json({ ok: false, error: "未知的錯誤" }, { status: 500 });
  }
};

// ---

/**
 * `DELETE /api/committed/[filename]`
 *
 * 取消提交，僅移除 DB 記錄，檔案保留於 images/ 並回到 staged 狀態。
 */
export const DELETE: RequestHandler = ({ params }) => {
  if (!database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { filename } = params;
  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  try {
    database.removeImage(filename);

    log({ level: "info", module: "committed/[id]", message: `取消提交: ${filename}` });
    return json({ ok: true, data: { filename } });
  } catch (e) {
    if (e instanceof Error && "status" in e && typeof e.status === "number") {
      return json({ ok: false, error: e.message }, { status: e.status });
    }

    log({
      level: "error",
      module: "committed/[id]",
      message: `DELETE 未知錯誤: ${filename}`,
      data: { error: String(e) },
    });

    return json({ ok: false, error: "未知的錯誤" }, { status: 500 });
  }
};
