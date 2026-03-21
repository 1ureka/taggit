import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { requireDatabase, requirePaths } from "$lib/server/db-instance.js";
import { getStagedFiles, uniqueFilename } from "$lib/server/helpers.js";
import { IMG_EXTS } from "$lib/server/config.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MiB

/**
 * `GET /api/staged`
 *
 * 列出所有暫存區中的圖片檔名。
 */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { db, paths } = loaded;
  return json({ ok: true, data: { files: getStagedFiles(db, paths) } });
};

// ---

/**
 * `POST /api/staged`
 *
 * 上傳圖片檔案至 images/ 目錄（尚未提交至 db.json）。
 */
export const POST: RequestHandler = async ({ request }) => {
  const paths = requirePaths();
  if (!paths) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json({ ok: false, error: "無效的表單資料格式" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, error: "無法解析表單資料" }, { status: 400 });
  }

  const files = formData.getAll("files");
  if (files.length === 0) {
    return json({ ok: false, error: "未提供任何檔案" }, { status: 400 });
  }

  // ---

  const added: string[] = [];
  const errors: string[] = [];

  for (const entry of files) {
    if (!(entry instanceof File)) {
      errors.push("非檔案項目已跳過");
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!IMG_EXTS.has(ext)) {
      errors.push(`${entry.name}: 不支援的檔案格式`);
      continue;
    }

    if (entry.size > MAX_UPLOAD_BYTES) {
      errors.push(`${entry.name}: 檔案大小超過限制，最大 50 MiB`);
      continue;
    }

    const destName = uniqueFilename(paths.images, entry.name);
    const destPath = path.join(paths.images, destName);

    try {
      const buffer = Buffer.from(await entry.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      added.push(destName);
    } catch (e) {
      errors.push(`${entry.name}: 無法寫入檔案 (${(e as Error).message})`);
    }
  }

  // ---

  if (added.length > 0) {
    return json({ ok: true, data: { added, errors } }, { status: 201 });
  }

  const summary = errors.length === 1 ? errors[0] : `${errors.length} 個檔案上傳失敗`;
  return json({ ok: false, error: summary }, { status: 400 });
};
