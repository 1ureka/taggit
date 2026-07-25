import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Mutation, type MutationError } from "$lib/mutation";

import { isRecord } from "$lib/utils/shared";
import { parseBody, log } from "$lib/utils/server";

/**
 * 單筆操作結果；key 是操作對象的標籤名稱，與前端變更集的 name 對齊。
 * TODO(/api/proto 轉正時一併處理)：delete/rename/hidden 三件事目前共用同一個扁平 `results`
 * 陣列，用裸 name 當 key 能對上是因為畫布保證同一標籤同時只會有一種操作（互斥），這個保證
 * 活在呼叫端（`../../../(app)/tags/+page.svelte` 的 `detachTag`），這支端點自己並不知道、
 * 也沒有驗證。更好的設計是回三個各自獨立對應請求陣列順序的結果集合（或乾脆拆成三支端點），
 * 屆時就不必依賴呼叫端的不變量也能保證不撞 key。
 */
type OpResult = { key: string; ok: boolean; error?: string };

/** 將 mutation 錯誤轉為具體的人類可讀訊息 */
function errorMessage(e: MutationError): string {
  switch (e.kind) {
    case "not_found":
      return "找不到目標紀錄";
    case "already_exists":
      return "目標紀錄已存在";
    case "stale_update":
      return "紀錄已被其他操作更新，請重新整理後再試";
    case "last_tag":
      return `有 ${e.images.length} 張圖片會因此失去最後一個標籤`;
    case "validation":
      return `${e.message}（欄位：${e.fields.join(", ")}）`;
  }
}

/**
 * `POST /api/proto/tags-batch`
 *
 * 原型專用：批次執行標籤層級操作（刪除 / 重新命名 / 顯隱覆寫）。
 * Body: `{ deletes?: string[], renames?: [{ from, to }], hidden?: [{ name, hidden }] }`
 * 執行順序為 deletes → renames → hidden（與前端預覽語意一致：刪除以原名為準，之後才套用重命名）。
 * 回傳逐筆結果：`{ results: [{ key, ok, error? }] }`。
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const deletes = Array.isArray(body.deletes) ? body.deletes : [];
  const renames = Array.isArray(body.renames) ? body.renames : [];
  const hidden = Array.isArray(body.hidden) ? body.hidden : [];

  if (deletes.length + renames.length + hidden.length === 0) {
    return json({ ok: false, error: "變更集為空" }, { status: 400 });
  }

  const mutation = new Mutation(Database.requireLoaded());
  const results: OpResult[] = [];

  for (const raw of deletes) {
    if (typeof raw !== "string") {
      results.push({ key: "delete:(未知)", ok: false, error: "項目格式無效" });
      continue;
    }
    const r = mutation.deleteTag(raw);
    results.push(r.ok ? { key: raw, ok: true } : { key: raw, ok: false, error: errorMessage(r.error) });
  }

  for (const raw of renames) {
    if (!isRecord(raw) || typeof raw.from !== "string" || typeof raw.to !== "string") {
      results.push({ key: "rename:(未知)", ok: false, error: "項目格式無效" });
      continue;
    }
    const r = mutation.renameTag(raw.from, raw.to);
    results.push(r.ok ? { key: raw.from, ok: true } : { key: raw.from, ok: false, error: errorMessage(r.error) });
  }

  for (const raw of hidden) {
    if (!isRecord(raw) || typeof raw.name !== "string" || typeof raw.hidden !== "boolean") {
      results.push({ key: "hidden:(未知)", ok: false, error: "項目格式無效" });
      continue;
    }
    const r = mutation.setTagMeta(raw.name, { hidden: raw.hidden });
    results.push(r.ok ? { key: raw.name, ok: true } : { key: raw.name, ok: false, error: errorMessage(r.error) });
  }

  const okCount = results.filter((r) => r.ok).length;
  log({ level: "info", module: "proto/tags-batch", message: `批次標籤操作: 成功 ${okCount}/${results.length}` });

  return json({ ok: true, data: { results } });
};
