import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";

/**
 * `GET /api/settings/missing`
 *
 * 列出資料庫中對應圖片檔案已不存在的記錄。
 */
export const GET: RequestHandler = () => {
  const root = collection.getActiveRoot();
  if (!root || !database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const imagesDir = collection.getCollectionPaths(root).images;
  const missing: string[] = [];

  for (const { id } of database.getAllImages()) {
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
  const root = collection.getActiveRoot();
  if (!root || !database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const imagesDir = collection.getCollectionPaths(root).images;
  const removed: string[] = [];

  for (const { id } of database.getAllImages()) {
    if (!fs.existsSync(path.join(imagesDir, id))) {
      database.removeImage(id);
      removed.push(id);
    }
  }

  return json({ ok: true, data: { removed } });
};
