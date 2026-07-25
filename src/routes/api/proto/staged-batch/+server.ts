import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { ImageLibrary } from "$lib/image/server";
import { Database } from "$lib/database";
import { Mutation, type MutationError } from "$lib/mutation";

import { isRecord, isSafeFilename, formatError } from "$lib/utils/shared";
import { parseBody, log } from "$lib/utils/server";

/** 單筆結果，錯誤一律收斂成人類可讀訊息 */
type ItemResult = { filename: string; ok: boolean; error?: string };

/** 將 mutation 錯誤轉為具體的人類可讀訊息 */
function errorMessage(e: MutationError): string {
  switch (e.kind) {
    case "not_found":
      return "找不到紀錄";
    case "already_exists":
      return "已提交過，請重新整理列表";
    case "stale_update":
      return "紀錄已被其他操作更新，請重新整理後再試";
    case "last_tag":
      return "有圖片會因此失去最後一個標籤";
    case "validation":
      return `${e.message}（欄位：${e.fields.join(", ")}）`;
  }
}

/**
 * `POST /api/proto/staged-batch`
 *
 * 原型專用：批次提交暫存圖片。
 * Body: `{ items: [{ filename, name?, tags, rating }] }`
 * 回傳逐筆結果：`{ results: [{ filename, ok, error? }] }`
 */
export const POST: RequestHandler = async ({ request }) => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded() || !ImageLibrary.isActive()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const items = isRecord(body) ? body.items : undefined;
  if (!Array.isArray(items) || items.length === 0) {
    return json({ ok: false, error: "items 必須是非空陣列" }, { status: 400 });
  }

  const mutation = new Mutation(Database.requireLoaded());

  const results: ItemResult[] = [];

  for (const raw of items) {
    if (!isRecord(raw) || typeof raw.filename !== "string") {
      results.push({ filename: "(未知)", ok: false, error: "項目格式無效" });
      continue;
    }

    const filename = raw.filename;
    const fail = (error: string) => results.push({ filename, ok: false, error });

    if (!isSafeFilename(filename)) {
      fail("無效的檔名");
      continue;
    }
    if (!ImageLibrary.isImageFile(filename)) {
      fail("非圖片檔案");
      continue;
    }
    if (!ImageLibrary.has(filename)) {
      fail("檔案不存在，可能已被移除");
      continue;
    }

    // name 為可選；未提供時沿用去副檔名的檔名
    const ext = path.extname(filename).toLowerCase();
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : path.basename(filename, ext);

    try {
      const probed = await ImageLibrary.probe(filename);
      if (!probed.ok) {
        fail("檔案不存在，可能已被移除");
        continue;
      }

      const r = mutation.commitRecord(filename, { name, tags: raw.tags, rating: raw.rating }, probed.data);
      if (!r.ok) {
        fail(errorMessage(r.error));
        continue;
      }

      results.push({ filename, ok: true });
    } catch (err) {
      fail(`處理失敗: ${formatError(err)}`);
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  log({ level: "info", module: "proto/staged-batch", message: `批次提交: 成功 ${okCount}/${results.length}` });

  return json({ ok: true, data: { results } });
};
