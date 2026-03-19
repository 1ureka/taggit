import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { queryImages, getImage } from "$lib/server/db-query.js";
import { removeImage } from "$lib/server/db-mutation.js";
import { parseQueryParams } from "$lib/utils.js";
import { parseBody } from "$lib/server/helpers.js";
import { requireDatabase } from "$lib/server/db-instance.js";
import { isValidFilename } from "$lib/server/validation.js";

/**
 * `GET /api/committed`
 *
 * 查詢已提交圖片，支援篩選與分頁。
 * （sort=random + limit=2 供 /compare 頁面使用）
 */
export const GET: RequestHandler = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  return json({ ok: true, data: queryImages(loaded.db, parseQueryParams(url)) });
};

// ---

/**
 * `DELETE /api/committed`
 *
 * 批量取消提交，僅移除 DB 記錄，檔案保留於 images/ 並回到 staged 狀態。
 * Body: `{ ids: string[] }`
 */
export const DELETE: RequestHandler = async ({ request }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return json({ ok: false, error: "ids must be a non-empty array" }, { status: 400 });
  }

  const { db } = loaded;
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const id of ids) {
    if (!isValidFilename(id)) {
      results.push({ id: String(id ?? ""), ok: false, error: "Invalid filename" });
      continue;
    }

    const image = getImage(db, id);
    if (!image) {
      results.push({ id, ok: false, error: "Image not found" });
      continue;
    }

    removeImage(db, id);
    results.push({ id, ok: true });
  }

  return json({ ok: true, data: { results } });
};
