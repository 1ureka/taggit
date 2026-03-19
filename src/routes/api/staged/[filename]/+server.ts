import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { requireDatabase } from "$lib/server/db-instance.js";
import { addImage } from "$lib/server/db-mutation.js";
import { hasImage } from "$lib/server/db-query.js";

import type { ImageRecord } from "$lib/types.js";
import { IMG_EXTS } from "$lib/server/config.js";
import { isValidFilename, isValidTags, isValidRating } from "$lib/server/validation.js";
import { parseBody } from "$lib/server/helpers.js";
import { generateMetadata } from "$lib/server/thumbnail.js";

/**
 * `POST /api/staged/[filename]`
 *
 * 將暫存檔案提交至資料庫。
 * Body: `{ tags, rating }`，filename 來自 URL 路徑參數。
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { db, paths } = loaded;

  // ---

  const { filename } = params;
  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  if (!IMG_EXTS.has(path.extname(filename).toLowerCase())) {
    return json({ ok: false, error: "非圖片檔案" }, { status: 400 });
  }

  if (hasImage(db, filename)) {
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

  if (!isValidTags(tags)) {
    return json({ ok: false, error: "無效的標籤 (必須是非空的唯一且非空字串陣列)" }, { status: 400 });
  }

  if (!isValidRating(rating)) {
    return json({ ok: false, error: "無效的評分 (必須是 0 ~ 5 的整數)" }, { status: 400 });
  }

  // ---

  try {
    const now = Date.now();

    const ext = path.extname(filename).toLowerCase();
    const stat = fs.statSync(filePath);
    const meta = await generateMetadata(filePath);
    const trimmedTags = tags.map((t) => t.trim());

    const record: ImageRecord = {
      name: path.basename(filename, ext),
      tags: trimmedTags,
      rating,
      committedAt: now,
      updatedAt: now,
      fileSize: stat.size,
      ...meta,
    };

    addImage(db, filename, record);
    return json({ ok: true, data: { id: filename, ...record } }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") {
      return json({ ok: false, error: "檔案不存在" }, { status: 404 });
    }

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
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { db, paths } = loaded;

  const { filename } = params;
  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "無效的檔名" }, { status: 400 });
  }

  if (hasImage(db, filename)) {
    return json({ ok: false, error: "無法透過暫存區端點刪除已提交的圖片" }, { status: 409 });
  }

  const filePath = path.join(paths.images, filename);
  if (!fs.existsSync(filePath)) {
    return json({ ok: false, error: "檔案不存在" }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  return json({ ok: true, data: { filename } });
};
