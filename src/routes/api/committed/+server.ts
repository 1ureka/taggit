import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { requireDatabase } from "$lib/server/db-instance.js";
import { queryImages } from "$lib/server/db-query.js";
import { upsertRecord } from "$lib/server/db-mutation.js";

import type { ImageRecord, ImportEntry } from "$lib/types.js";
import { IMG_EXTS } from "$lib/server/config.js";
import { isValidFilename, isValidTags, isValidRating, isValidName } from "$lib/server/validation.js";
import { log } from "$lib/server/helpers.js";
import { generateMetadata } from "$lib/server/thumbnail.js";
import { isRecord, parseQueryParams } from "$lib/utils.js";

/**
 * `GET /api/committed`
 *
 * 查詢已提交圖片，支援篩選與分頁。
 */
export const GET: RequestHandler = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  return json({ ok: true, data: queryImages(loaded.db, parseQueryParams(url)) });
};

// ---

function validateEntry(
  filename: string,
  value: unknown,
  imagesDir: string,
): { ok: true; entry: ImportEntry } | { ok: false; error: string } {
  if (!isValidFilename(filename)) {
    return { ok: false, error: `無效的檔名: ${filename}` };
  }

  if (!IMG_EXTS.has(path.extname(filename).toLowerCase())) {
    return { ok: false, error: `非圖片檔案: ${filename}` };
  }

  if (!fs.existsSync(path.join(imagesDir, filename))) {
    return { ok: false, error: `檔案不存在: ${filename}` };
  }

  if (!isRecord(value)) {
    return { ok: false, error: `紀錄格式無效: ${filename}` };
  }

  const { name, tags, rating } = value as Record<string, unknown>;

  if (!isValidName(name)) {
    return { ok: false, error: `名稱無效或缺失: ${filename}` };
  }

  if (!isValidTags(tags)) {
    return { ok: false, error: `標籤無效: ${filename}` };
  }

  const resolvedRating = rating !== undefined ? rating : 0;
  if (!isValidRating(resolvedRating)) {
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
  const loaded = requireDatabase();
  if (!loaded) {
    return new Response(JSON.stringify({ ok: false, error: "尚未載入資料庫" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { db, paths } = loaded;

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
          const filePath = path.join(paths.images, filename);
          const stat = fs.statSync(filePath);
          const meta = await generateMetadata(filePath);
          const trimmedTags = entry.tags.map((t) => t.trim());

          const now = Date.now();
          const record: ImageRecord = {
            name: entry.name,
            tags: trimmedTags,
            rating: entry.rating ?? 0,
            committedAt: now,
            updatedAt: now,
            fileSize: stat.size,
            ...meta,
          };

          upsertRecord(db, filename, record);
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

      db.buildIndexes();
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
