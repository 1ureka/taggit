import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { uniqueFilename, log } from "$lib/utils/server";
import { formatError } from "$lib/utils/shared";

import { Collection } from "$lib/collection";
import * as image from "$lib/image/server";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MiB

/**
 * `POST /api/staged`
 *
 * 上傳圖片檔案至 images/ 目錄（尚未提交至 db.json）。
 */
export const POST: RequestHandler = async ({ request }) => {
  const root = Collection.getActiveRoot();
  if (!root) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const paths = Collection.paths(root);

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

    if (!image.isImageFile(entry.name)) {
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
      errors.push(`${entry.name}: 無法寫入檔案 (${formatError(e)})`);
    }
  }

  // ---

  if (added.length > 0) {
    log({ level: "info", module: "staged", message: `新增了 ${added.length} 個檔案至暫存區` });
    return json({ ok: true, data: { added, errors } }, { status: 201 });
  }

  const summary = errors.length === 1 ? errors[0] : `${errors.length} 個檔案上傳失敗`;
  return json({ ok: false, error: summary }, { status: 400 });
};
