import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import { generateMetadata } from "$lib/image/server.js";

/**
 * `POST /api/settings/metadata`
 *
 * 為缺少 blurhash 或寬高的圖片補算元資料。
 */
export const POST: RequestHandler = async () => {
  const root = collection.getActiveRoot();
  if (!root || !database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const imagesDir = collection.getCollectionPaths(root).images;

  let updated = 0;

  for (const record of database.getAllImages()) {
    const needsBlurhash = !record.blurhash;
    const needsDimensions = record.width === 0 || record.height === 0;
    if (!needsBlurhash && !needsDimensions) continue;

    const meta = await generateMetadata(path.join(imagesDir, record.id));

    const patch: { width?: number; height?: number; blurhash?: string } = {};

    if (needsBlurhash && meta.blurhash) {
      patch.blurhash = meta.blurhash;
    }

    if (needsDimensions && meta.width > 0 && meta.height > 0) {
      patch.width = meta.width;
      patch.height = meta.height;
    }

    if (Object.keys(patch).length > 0) {
      database.updateImageFileMeta(record.id, patch);
      updated++;
    }
  }

  return json({ ok: true, data: { updated } });
};

// ---

/**
 * `GET /api/settings/metadata`
 *
 * 檢查缺少元資料的圖片數量。
 */
export const GET: RequestHandler = () => {
  if (!database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  let missing = 0;

  for (const record of database.getAllImages()) {
    if (!record.blurhash || record.width === 0 || record.height === 0) {
      missing++;
    }
  }

  return json({ ok: true, data: { missing } });
};
