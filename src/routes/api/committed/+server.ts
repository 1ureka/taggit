import fs from "fs";
import path from "path";
import type { RequestHandler } from "@sveltejs/kit";

import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import * as image from "$lib/image/server.js";
import type { ImportEntry } from "$lib/database/server.js";

import { isValidFilename } from "$lib/utils/shared.js";
import { log } from "$lib/utils/server.js";
import { isRecord } from "$lib/utils/shared.js";

function validateEntry(
  filename: string,
  value: unknown,
  imagesDir: string,
): { ok: true; entry: ImportEntry } | { ok: false; error: string } {
  if (!isValidFilename(filename)) {
    return { ok: false, error: `無效的檔名: ${filename}` };
  }

  if (!image.isImageFile(filename)) {
    return { ok: false, error: `非圖片檔案: ${filename}` };
  }

  if (!fs.existsSync(path.join(imagesDir, filename))) {
    return { ok: false, error: `檔案不存在: ${filename}` };
  }

  if (!isRecord(value)) {
    return { ok: false, error: `紀錄格式無效: ${filename}` };
  }

  const { name, tags, rating } = value as Record<string, unknown>;

  if (!database.isValidName(name)) {
    return { ok: false, error: `名稱無效或缺失: ${filename}` };
  }

  if (!database.isValidTags(tags)) {
    return { ok: false, error: `標籤無效: ${filename}` };
  }

  const resolvedRating = rating !== undefined ? rating : 0;
  if (!database.isValidRating(resolvedRating)) {
    return { ok: false, error: `評分無效: ${filename}` };
  }

  return { ok: true, entry: { name, tags, rating: resolvedRating } };
}

/**
 * `POST /api/committed`
 *
 * 匯入圖片紀錄至資料庫。接收 JSON body，逐筆驗證並處理，
 * 以 SSE (Server-Sent Events) 串流回傳即時進度。
 *
 * Body 格式: `Record<filename, ImportEntry>`
 *
 * SSE 事件格式:
 * - `{ event: "progress", current, total, filename, ok, error? }`
 * - `{ event: "done", imported, skipped, errors }`
 */
export const POST: RequestHandler = async ({ request }) => {
  const root = collection.getActiveRoot();
  if (!root || !database.isLoaded()) {
    return new Response(JSON.stringify({ ok: false, error: "尚未載入資料庫" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const paths = collection.getCollectionPaths(root);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "無效的 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isRecord(body) || Object.keys(body).length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "JSON 必須是非空的物件" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const entries = Object.entries(body);
  const total = entries.length;

  log({ level: "info", module: "import", message: `開始匯入 ${total} 筆紀錄` });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < entries.length; i++) {
        const [filename, value] = entries[i];
        const current = i + 1;

        const validation = validateEntry(filename, value, paths.images);
        if (!validation.ok) {
          errors.push(validation.error);
          skipped++;
          send({ event: "progress", current, total, filename, ok: false, error: validation.error });
          log({
            level: "warn",
            module: "import",
            message: `[${current}/${total}] SKIP ${filename} — ${validation.error}`,
          });
          continue;
        }

        const { entry } = validation;

        try {
          // route 層組合：image 提供檔案側元資料，database 只收純資料
          const fileInfo = await image.readImageInfo(path.join(paths.images, filename));
          database.commitImage(filename, entry, fileInfo);

          imported++;
          send({ event: "progress", current, total, filename, ok: true });
          log({ level: "info", module: "import", message: `[${current}/${total}] ✓ ${filename}` });
        } catch (err) {
          const msg = `處理失敗: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(`${filename}: ${msg}`);
          skipped++;
          send({ event: "progress", current, total, filename, ok: false, error: msg });
          log({ level: "error", module: "import", message: `[${current}/${total}] FAIL ${filename} — ${msg}` });
        }
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
