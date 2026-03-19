import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { removeImage } from "$lib/server/db-mutation.js";
import { requireDatabase } from "$lib/server/db-instance.js";

/**
 * `GET /api/settings/missing`
 *
 * 列出資料庫中對應圖片檔案已不存在的記錄。
 */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const missing: string[] = [];

  for (const filename of Object.keys(db.data.images)) {
    if (!fs.existsSync(path.join(paths.images, filename))) missing.push(filename);
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
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const removed: string[] = [];

  for (const filename of Object.keys(db.data.images)) {
    if (!fs.existsSync(path.join(paths.images, filename))) {
      removeImage(db, filename);
      removed.push(filename);
    }
  }

  return json({ ok: true, data: { removed } });
};
