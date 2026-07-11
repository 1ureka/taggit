import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { generateMetadata } from "$lib/image/server";
import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { Mutation, type FileMetaPatch } from "$lib/mutation";

/**
 * `POST /api/settings/metadata`
 *
 * 為缺少 blurhash 或寬高的圖片補算元資料。
 */
export const POST: RequestHandler = async () => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const imagesDir = Collection.paths(root).images;
  const db = Database.requireLoaded();
  const query = new Query(db);
  const mutation = new Mutation(db);

  let updated = 0;

  for (const record of query.getAllImages()) {
    const needsBlurhash = !record.blurhash;
    const needsDimensions = record.width === 0 || record.height === 0;
    if (!needsBlurhash && !needsDimensions) continue;

    const meta = await generateMetadata(path.join(imagesDir, record.id));

    const patch: FileMetaPatch = {};

    if (needsBlurhash && meta.blurhash) {
      patch.blurhash = meta.blurhash;
    }

    if (needsDimensions && meta.width > 0 && meta.height > 0) {
      patch.width = meta.width;
      patch.height = meta.height;
    }

    if (Object.keys(patch).length > 0) {
      const r = mutation.updateRecordFileMeta(record.id, patch);
      if (r.ok) updated++;
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
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const query = new Query(Database.requireLoaded());

  let missing = 0;

  for (const record of query.getAllImages()) {
    if (!record.blurhash || record.width === 0 || record.height === 0) {
      missing++;
    }
  }

  return json({ ok: true, data: { missing } });
};
