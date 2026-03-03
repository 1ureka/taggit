import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { IMG_EXTS } from "$lib/server/config.js";
import { guardLoaded, getPaths, getTrashFiles } from "$lib/server/helpers.js";

/**
 * GET /api/trash — list trash filenames (filesystem scan, no DB).
 */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: { files: getTrashFiles() } });
};

/**
 * DELETE /api/trash — permanently delete ALL files in trash/.
 */
export const DELETE: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const trashDir = getPaths().trash;
  let deleted = 0;

  try {
    for (const file of fs.readdirSync(trashDir)) {
      const ext = path.extname(file).toLowerCase();
      if (!IMG_EXTS.has(ext)) continue;
      try {
        fs.unlinkSync(path.join(trashDir, file));
        deleted++;
      } catch (e) {
        console.error(`[trash] Failed to delete ${file}:`, (e as Error).message);
      }
    }
  } catch {
    /* empty trash dir or can't read */
  }

  return json({ ok: true, data: { deleted } });
};
