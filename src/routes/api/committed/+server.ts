import { json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { ImageLibrary } from "$lib/image/server";
import { Database } from "$lib/database";
import { Mutation } from "$lib/mutation";

import { isRecord, isSafeFilename, formatError } from "$lib/utils/shared";
import { log } from "$lib/utils/server";

// ---

/** 單筆匯入的結果；失敗一律收斂成人類可讀的 error，`unexpected` 標記非預期例外。 */
type ImportResult = { ok: true } | { ok: false; error: string; unexpected?: boolean };

/** 逐筆串流回傳給前端的即時事件。 */
type ImportEvent =
  | { event: "progress"; current: number; total: number; filename: string; ok: boolean; error?: string }
  | { event: "done"; imported: number; skipped: number; errors: string[] };

// ---

/**
 * 匯入前的檔案側檢查：檔名安全、副檔名為圖片、實體檔案存在、紀錄為物件。
 * 紀錄欄位（name / tags / rating）本身的驗證留給 mutation。
 */
function precheckEntry(filename: string, value: unknown): ImportResult {
  if (!isSafeFilename(filename)) return { ok: false, error: `無效的檔名: ${filename}` };
  if (!ImageLibrary.isImageFile(filename)) return { ok: false, error: `非圖片檔案: ${filename}` };
  if (!ImageLibrary.has(filename)) return { ok: false, error: `檔案不存在: ${filename}` };
  if (!isRecord(value)) return { ok: false, error: `紀錄格式無效: ${filename}` };
  return { ok: true };
}

/**
 * 匯入單筆紀錄：通過前置檢查後，讀取檔案元資料並寫入資料庫。
 * 不擲出例外，一切失敗（含非預期例外）都收斂成 {@link ImportResult}。
 *
 * 走 `restoreRecord` 而非 `commitRecord`：匯入的語意是「以檔案為準重建收藏庫」，
 * 覆寫既有紀錄是預期行為。
 */
async function importEntry(filename: string, value: unknown, mutation: Mutation): Promise<ImportResult> {
  const precheck = precheckEntry(filename, value);
  if (!precheck.ok) return precheck;

  try {
    const probed = await ImageLibrary.probe(filename);
    if (!probed.ok) return { ok: false, error: `檔案不存在: ${filename}` };

    const restored = mutation.restoreRecord(filename, value, probed.data);

    if (!restored.ok) {
      const { message, fields } = restored.error;
      return { ok: false, error: `${filename}: ${message} (${fields.join(", ")})` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `${filename}: 處理失敗: ${formatError(err)}`, unexpected: true };
  }
}

// ---

/**
 * `POST /api/committed`
 *
 * 匯入圖片紀錄至資料庫。Body 為 `Record<filename, ImportEntry>`，
 * 逐筆匯入並以 SSE (Server-Sent Events) 串流回傳即時進度：
 * - `{ event: "progress", current, total, filename, ok, error? }`
 * - `{ event: "done", imported, skipped, errors }`
 */
export const POST: RequestHandler = async ({ request }) => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded() || !ImageLibrary.isActive()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "無效的 JSON" }, { status: 400 });
  }

  if (!isRecord(body) || Object.keys(body).length === 0) {
    return json({ ok: false, error: "JSON 必須是非空的物件" }, { status: 400 });
  }

  const mutation = new Mutation(Database.requireLoaded());
  const entries = Object.entries(body);
  const total = entries.length;

  log({ level: "info", module: "import", message: `開始匯入 ${total} 筆紀錄` });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ImportEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < entries.length; i++) {
        const [filename, value] = entries[i];
        const current = i + 1;
        const position = `[${current}/${total}]`;

        const result = await importEntry(filename, value, mutation);

        if (result.ok) {
          imported++;
          send({ event: "progress", current, total, filename, ok: true });
          log({ level: "info", module: "import", message: `${position} ✓ ${filename}` });
          continue;
        }

        skipped++;
        errors.push(result.error);
        send({ event: "progress", current, total, filename, ok: false, error: result.error });

        const level = result.unexpected ? "error" : "warn";
        const tag = result.unexpected ? "FAIL" : "SKIP";
        log({ level, module: "import", message: `${position} ${tag} ${filename} — ${result.error}` });
      }

      send({ event: "done", imported, skipped, errors });
      log({ level: "info", module: "import", message: `匯入完成: 成功 ${imported}, 跳過 ${skipped}` });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
