import fs from "fs";
import path from "path";
import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { Mutation } from "$lib/mutation";
import { Query } from "$lib/query";
import { log } from "$lib/utils/server";

/** 掃出所有「有紀錄、實體檔案卻不存在」的 id */
function scan(imagesDir: string, query: Query): string[] {
  return query
    .getAllImages()
    .map((r) => r.id)
    .filter((id) => !fs.existsSync(path.join(imagesDir, id)));
}

/**
 * `GET /api/maintenance/orphans`
 *
 * 列出對應圖片檔案已不存在的紀錄。
 */
export const GET: RequestHandler = () => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded()) error(503, "尚未載入圖片集");

  const items = scan(Collection.paths(root).images, new Query(Database.requireLoaded()));
  return json({ items, total: items.length });
};

/**
 * `DELETE /api/maintenance/orphans`
 *
 * 移除所有對應圖片檔案已不存在的紀錄。
 */
export const DELETE: RequestHandler = () => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded()) error(503, "尚未載入圖片集");

  const db = Database.requireLoaded();
  const mutation = new Mutation(db);

  const removed: string[] = [];
  for (const id of scan(Collection.paths(root).images, new Query(db))) {
    if (mutation.removeRecord(id).ok) removed.push(id);
  }

  log({ level: "info", module: "maintenance/orphans", message: `移除孤兒紀錄 ${removed.length} 筆` });
  return json({ removed });
};
