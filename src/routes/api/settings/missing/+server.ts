import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { Mutation } from "$lib/mutation";

/**
 * `GET /api/settings/missing`
 *
 * 列出資料庫中對應圖片檔案已不存在的記錄。
 */
export const GET: RequestHandler = () => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const imagesDir = Collection.paths(root).images;
  const query = new Query(Database.requireLoaded());
  const missing: string[] = [];

  for (const { id } of query.getAllImages()) {
    if (!fs.existsSync(path.join(imagesDir, id))) missing.push(id);
  }

  return json({ ok: true, data: { missing } });
};

// ---

/**
 * `DELETE /api/settings/missing`
 *
 * 移除所有對應圖片檔案已不存在的資料庫記錄。
 */
export const DELETE: RequestHandler = () => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const imagesDir = Collection.paths(root).images;
  const db = Database.requireLoaded();
  const query = new Query(db);
  const mutation = new Mutation(db);
  const removed: string[] = [];

  for (const { id } of query.getAllImages()) {
    if (!fs.existsSync(path.join(imagesDir, id))) {
      const r = mutation.removeRecord(id);
      if (r.ok) removed.push(id);
    }
  }

  return json({ ok: true, data: { removed } });
};
