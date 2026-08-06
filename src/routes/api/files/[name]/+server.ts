import fs from "fs";
import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { ImageLibrary, type ImagePayload, type Result } from "$lib/image/server";
import { Query } from "$lib/query";

import { isSafeFilename, formatError } from "$lib/utils/shared";
import { log } from "$lib/utils/server";

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
 * `GET /api/files/[name]`
 *
 * 取得檔案的二進位內容。這支端點的資源表示就是圖片本身，因此不回 JSON。
 * Query：`size=sm|md|xl`（預設 `xl` 原圖）、`animated=1`（縮圖時保留多幀動畫）。
 */
export const GET: RequestHandler = async ({ params, url }) => {
  if (!ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const { name } = params;
  if (!isSafeFilename(name)) error(400, "無效的檔名");

  const size = url.searchParams.get("size") ?? "xl";
  if (!ImageLibrary.isValidSize(size)) error(400, "無效的尺寸");

  const animated = url.searchParams.get("animated") === "1";

  let payload: Result<ImagePayload>;
  try {
    payload = await ImageLibrary.payload(name, size, animated);
  } catch (e) {
    log({ level: "error", module: "files/[name]", message: `圖片處理失敗: ${name}`, data: { error: String(e) } });
    error(500, "處理圖片失敗");
  }

  if (!payload.ok) {
    if (payload.error.kind === "forbidden") error(403, "路徑不在圖片集內");
    error(404, "找不到檔案");
  }

  const headers: HeadersInit = {
    "Cache-Control": "private, max-age=60",
    "Content-Type": payload.data.contentType,
  };

  if (payload.data.kind === "stream") {
    headers["Content-Length"] = String(payload.data.length);
  }

  return new Response(payload.data.body, { headers });
};

/**
 * `DELETE /api/files/[name]`
 *
 * 永久刪除實體檔案。已有紀錄的檔案不接受直接刪除——退回與刪檔是兩個獨立的決定，
 * 必須先 `DELETE /api/records/[id]` 才能刪檔。
 */
export const DELETE: RequestHandler = async ({ params }) => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const { name } = params;
  if (!isSafeFilename(name)) error(400, "無效的檔名");

  const query = new Query(Database.requireLoaded());
  if (query.hasImage(name)) error(409, "請先退回提交，再刪除檔案");

  const resolved = ImageLibrary.resolve(name);
  if (!resolved.ok) error(404, "找不到檔案");

  try {
    await unlinkWithRetry(resolved.data);
  } catch (e) {
    log({ level: "error", module: "files/[name]", message: `刪除失敗: ${name} (${formatError(e)})` });
    error(500, "檔案刪除失敗，請稍後再試");
  }

  log({ level: "info", module: "files/[name]", message: `刪除檔案: ${name}` });
  return json({ name });
};
