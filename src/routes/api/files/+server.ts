import fs from "fs";
import path from "path";
import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { ImageLibrary } from "$lib/image/server";
import { Query } from "$lib/query";

import { formatError } from "$lib/utils/shared";
import { uniqueFilename, log } from "$lib/utils/server";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MiB

/** 單筆上傳結果；以陣列索引對齊請求順序，見下方 POST 的說明 */
type UploadResult = { ok: true; name: string; id: string } | { ok: false; name: string; message: string };

/**
 * `GET /api/files`
 *
 * 列出圖片集裡的實體檔案。
 * Query：`state=staged|committed|all`（預設 `all`）——`staged` 是「沒有紀錄的檔案」，
 * `committed` 是「已有紀錄的檔案」，兩者都只是同一批實體檔案的分群。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const query = new Query(Database.requireLoaded());

  const state = url.searchParams.get("state") ?? "all";
  if (state !== "staged" && state !== "committed" && state !== "all") error(400, "無效的 state");

  const items = ImageLibrary.list()
    .map((name) => ({ name, committed: query.hasImage(name) }))
    .filter((f) => state === "all" || (state === "committed") === f.committed);

  return json({ items, total: items.length });
};

/**
 * `POST /api/files`
 *
 * 上傳圖片檔案至圖片集（僅落地，尚未建立紀錄）。multipart/form-data，欄位名 `files`。
 *
 * 這是全專案唯一以**陣列**回報逐筆結果的批次端點：上傳當下 id 還不存在（最終檔名由
 * `uniqueFilename` 決定），且同一次上傳可能有兩個同名檔案，沒有任何欄位能安全地當鍵。
 */
export const POST: RequestHandler = async ({ request }) => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) error(400, "請求必須是 multipart/form-data");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    error(400, "無法解析表單資料");
  }

  const files = formData.getAll("files");
  if (files.length === 0) error(400, "未提供任何檔案");

  const imagesDir = Collection.paths(root).images;
  const results: UploadResult[] = [];

  for (const entry of files) {
    if (!(entry instanceof File)) {
      results.push({ ok: false, name: "(未知)", message: "非檔案項目" });
      continue;
    }

    const name = entry.name;

    if (!ImageLibrary.isImageFile(name)) {
      results.push({ ok: false, name, message: "不支援的檔案格式" });
      continue;
    }

    if (entry.size > MAX_UPLOAD_BYTES) {
      results.push({ ok: false, name, message: "檔案大小超過限制，最大 50 MiB" });
      continue;
    }

    const id = uniqueFilename(imagesDir, name);

    try {
      const buffer = Buffer.from(await entry.arrayBuffer());
      fs.writeFileSync(path.join(imagesDir, id), buffer);
      results.push({ ok: true, name, id });
    } catch (e) {
      results.push({ ok: false, name, message: `無法寫入檔案 (${formatError(e)})` });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  log({ level: "info", module: "files", message: `上傳: 成功 ${okCount}/${results.length}` });

  return json({ results });
};
