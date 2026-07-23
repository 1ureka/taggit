import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Mutation, type MutationError } from "$lib/mutation";

import { isRecord, isSafeFilename } from "$lib/utils/shared";
import { parseBody, log } from "$lib/utils/server";

/** 單筆結果，錯誤一律收斂成人類可讀訊息 */
type ItemResult = { id: string; ok: boolean; error?: string };

/** 將 mutation 錯誤轉為具體的人類可讀訊息 */
function errorMessage(e: MutationError): string {
  switch (e.kind) {
    case "not_found":
      return "找不到紀錄，可能已被退回";
    case "stale_update":
      return "紀錄已被其他操作更新，請重新整理後再試";
    case "last_tag":
      return "有圖片會因此失去最後一個標籤";
    case "validation":
      return `${e.message}（欄位：${e.fields.join(", ")}）`;
  }
}

/**
 * `POST /api/proto/committed-batch`
 *
 * 原型專用：批次更新已提交圖片的名稱 / 標籤 / 評等，或批次退回（刪除紀錄）。
 * Body: `{ items: [{ id, op?: "update", name?, tags?, rating?, expectedUpdatedAt } | { id, op: "revert" }] }`
 * 回傳逐筆結果：`{ results: [{ id, ok, error? }] }`
 *
 * TODO: 原型端點，混雜 update/revert 兩種操作；正式轉正時應拆成語意更清楚的端點或改走真正的批次 command 模式
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
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
    if (!isRecord(raw) || typeof raw.id !== "string") {
      results.push({ id: "(未知)", ok: false, error: "項目格式無效" });
      continue;
    }

    const id = raw.id;

    if (!isSafeFilename(id)) {
      results.push({ id, ok: false, error: "無效的檔名" });
      continue;
    }

    if (raw.op === "revert") {
      const r = mutation.removeRecord(id);
      if (!r.ok) {
        results.push({ id, ok: false, error: errorMessage(r.error) });
        continue;
      }
      results.push({ id, ok: true });
      continue;
    }

    const r = mutation.updateRecord(id, {
      name: raw.name,
      tags: raw.tags,
      rating: raw.rating,
      expectedUpdatedAt: raw.expectedUpdatedAt,
    });

    if (!r.ok) {
      results.push({ id, ok: false, error: errorMessage(r.error) });
      continue;
    }

    results.push({ id, ok: true });
  }

  const okCount = results.filter((r) => r.ok).length;
  log({ level: "info", module: "proto/committed-batch", message: `批次更新: 成功 ${okCount}/${results.length}` });

  return json({ ok: true, data: { results } });
};
