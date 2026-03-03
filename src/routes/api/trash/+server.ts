import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { guardLoaded, getPaths } from "$lib/server/helpers.js";

/** GET /api/trash — list all trashed images */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: { items: db.listTrash() } });
};

/** DELETE /api/trash — empty the trash (delete all trashed images permanently) */
export const DELETE: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const paths = getPaths();
  const entries = db.clearTrashRecords();

  for (const [id, rec] of entries) {
    try {
      const fp = path.join(paths.trash, id + rec.ext);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      console.error(`[trash] Failed to delete ${id}:`, (e as Error).message);
    }
  }

  return json({ ok: true, data: { deleted: entries.length } });
};
