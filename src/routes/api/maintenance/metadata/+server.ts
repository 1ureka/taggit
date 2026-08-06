import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { ImageLibrary } from "$lib/image/server";
import { Mutation, type FileMetaPatch } from "$lib/mutation";
import { Query } from "$lib/query";
import { log } from "$lib/utils/server";

/** 掃出所有缺少 blurhash 或寬高的紀錄 id */
function scan(query: Query): string[] {
  return query
    .getAllImages()
    .filter((r) => !r.blurhash || r.width === 0 || r.height === 0)
    .map((r) => r.id);
}

/**
 * `GET /api/maintenance/metadata`
 *
 * 列出缺少 blurhash 或寬高的紀錄。
 */
export const GET: RequestHandler = () => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const items = scan(new Query(Database.requireLoaded()));
  return json({ items, total: items.length });
};

/**
 * `PATCH /api/maintenance/metadata`
 *
 * 為缺少 blurhash 或寬高的紀錄重新讀取檔案並補齊。
 */
export const PATCH: RequestHandler = async () => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const db = Database.requireLoaded();
  const query = new Query(db);
  const mutation = new Mutation(db);

  const repaired: string[] = [];

  for (const id of scan(query)) {
    const record = query.getImage(id);
    if (!record) continue;

    const probed = await ImageLibrary.probe(id);
    if (!probed.ok) continue;
    const meta = probed.data;

    const patch: FileMetaPatch = {};
    if (!record.blurhash && meta.blurhash) patch.blurhash = meta.blurhash;
    if ((record.width === 0 || record.height === 0) && meta.width > 0 && meta.height > 0) {
      patch.width = meta.width;
      patch.height = meta.height;
    }

    if (Object.keys(patch).length === 0) continue;
    if (mutation.updateRecordFileMeta(id, patch).ok) repaired.push(id);
  }

  log({ level: "info", module: "maintenance/metadata", message: `補齊元資料 ${repaired.length} 筆` });
  return json({ repaired });
};
