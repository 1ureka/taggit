import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { ImageLibrary } from "$lib/image/server";
import { Mutation } from "$lib/mutation";
import { Query } from "$lib/query";
import { ImageQuery } from "$lib/query-spec";

import { isSafeFilename, formatError } from "$lib/utils/shared";
import { parseJsonObject, mutationMessage, log } from "$lib/utils/server";

/** 批次操作中單筆的結果。集合層回應一律是 `{ "<id>": ItemResult }`，鍵與請求完全對齊。 */
type ItemResult = { ok: true } | { ok: false; message: string };

const fail = (message: string): ItemResult => ({ ok: false, message });

/**
 * 建立單筆紀錄：檔案側前置檢查 → 讀取檔案元資料 → 交給 mutation。
 * 欄位本身（name / tags / rating）的合法性一律由 mutation 的 Validator 判斷，此處不補值也不預判。
 *
 * `mode` 為 `commit` 時 id 已存在會失敗；為 `restore` 時直接覆寫（匯入語意是「以檔案為準重建」）。
 */
async function writeOne(mutation: Mutation, id: string, entry: unknown, mode: "commit" | "restore"): Promise<ItemResult> {
  if (!isSafeFilename(id)) return fail("無效的檔名");
  if (!ImageLibrary.isImageFile(id)) return fail("非圖片檔案");
  if (!ImageLibrary.has(id)) return fail("檔案不存在，可能已被移除");

  try {
    const probed = await ImageLibrary.probe(id);
    if (!probed.ok) return fail("檔案不存在，可能已被移除");

    const r = mode === "commit" ? mutation.commitRecord(id, entry, probed.data) : mutation.restoreRecord(id, entry, probed.data);
    return r.ok ? { ok: true } : fail(mutationMessage(r.error));
  } catch (e) {
    return fail(`處理失敗: ${formatError(e)}`);
  }
}

/** 解析集合層批次請求的 keyed body 為非空的 `[id, 內容]` 陣列 */
async function parseEntries(request: Request): Promise<[string, unknown][]> {
  const entries = Object.entries(await parseJsonObject(request));
  if (entries.length === 0) error(400, "請求內容不得為空");
  return entries;
}

// ---

/**
 * `GET /api/records`
 *
 * 查詢已提交的圖片紀錄，吃 {@link ImageQuery} 的全部查詢參數（篩選、排序與分頁）。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const query = new Query(Database.requireLoaded());
  return json(query.images(ImageQuery.fromSearchParams(url.searchParams)));
};

/**
 * `POST /api/records`
 *
 * 批次提交（建立紀錄）。Body 是以檔名為鍵的物件，因此同一個檔名不可能在一次請求裡出現兩次。
 *
 * Body: `{ "<id>": { name, tags, rating? } }`
 * 回應: `{ "<id>": { ok } }`
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const entries = await parseEntries(request);
  const mutation = new Mutation(Database.requireLoaded());

  const results: Record<string, ItemResult> = {};
  for (const [id, entry] of entries) results[id] = await writeOne(mutation, id, entry, "commit");

  const okCount = entries.filter(([id]) => results[id].ok).length;
  log({ level: "info", module: "records", message: `批次提交: 成功 ${okCount}/${entries.length}` });

  return json(results);
};

/**
 * `PUT /api/records`
 *
 * 批次還原（建立或覆寫），供匯入使用。**唯一回 `text/event-stream` 的端點**：
 * 匯入動輒數千筆且每筆都要解碼圖片，必須邊做邊回報進度。
 *
 * Body: `{ "<id>": { name, tags, rating? } }`
 * 事件:
 * - `{ event: "progress", current, total, id, ok, message? }`
 * - `{ event: "done", imported, skipped, errors }`
 *
 * `done` 只帶彙總而非逐筆結果——逐筆的成敗已經在 progress 事件裡一一送出過了。
 */
export const PUT: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const entries = await parseEntries(request);
  const mutation = new Mutation(Database.requireLoaded());
  const total = entries.length;

  log({ level: "info", module: "records", message: `開始匯入 ${total} 筆紀錄` });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < entries.length; i++) {
        const [id, entry] = entries[i];
        const current = i + 1;
        const result = await writeOne(mutation, id, entry, "restore");

        if (result.ok) {
          imported++;
          send({ event: "progress", current, total, id, ok: true });
          log({ level: "info", module: "records", message: `[${current}/${total}] ✓ ${id}` });
          continue;
        }

        skipped++;
        errors.push(`${id}: ${result.message}`);
        send({ event: "progress", current, total, id, ok: false, message: result.message });
        log({ level: "warn", module: "records", message: `[${current}/${total}] SKIP ${id} — ${result.message}` });
      }

      send({ event: "done", imported, skipped, errors });
      log({ level: "info", module: "records", message: `匯入完成: 成功 ${imported}, 跳過 ${skipped}` });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
};

/**
 * `PATCH /api/records`
 *
 * 批次更新或退回。值為物件時是更新，為 `null` 時等同對該成員 `DELETE`（退回）。
 * 一個檔名只能是其中一種，這由 JSON 物件的鍵唯一性保證，端點不需要相信呼叫端。
 *
 * Body: `{ "<id>": { name?, tags?, rating?, expectedUpdatedAt } | null }`
 * 回應: `{ "<id>": { ok } }`
 */
export const PATCH: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const entries = await parseEntries(request);
  const mutation = new Mutation(Database.requireLoaded());

  const results: Record<string, ItemResult> = {};
  for (const [id, patch] of entries) {
    if (!isSafeFilename(id)) {
      results[id] = fail("無效的檔名");
      continue;
    }

    const r = patch === null ? mutation.removeRecord(id) : mutation.updateRecord(id, patch);
    results[id] = r.ok ? { ok: true } : fail(mutationMessage(r.error));
  }

  const okCount = entries.filter(([id]) => results[id].ok).length;
  log({ level: "info", module: "records", message: `批次更新: 成功 ${okCount}/${entries.length}` });

  return json(results);
};
