import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { IMG_EXTS } from "$lib/server/config.js";
import { guardLoaded, getPaths, getTrashFiles, uniqueFilename } from "$lib/server/helpers.js";

/**
 * GET /api/trash — list trash filenames with pagination & optional search.
 *
 * Query params:
 *   page   — 1-based page number (default 1)
 *   limit  — items per page (default 60, 0 = all)
 *   search — substring filter on filename (case-insensitive)
 */
export const GET: RequestHandler = ({ url }) => {
  const err = guardLoaded();
  if (err) return err;

  let allFiles = getTrashFiles();

  // Optional filename search
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  if (search) {
    allFiles = allFiles.filter((f) => f.toLowerCase().includes(search));
  }

  const total = allFiles.length;
  const limit = Math.max(0, parseInt(url.searchParams.get("limit") || "60", 10) || 60);

  if (limit === 0) {
    return json({ ok: true, data: { files: allFiles, total, page: 1, pages: 1 } });
  }

  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1), pages);
  const start = (page - 1) * limit;
  const files = allFiles.slice(start, start + limit);

  return json({ ok: true, data: { files, total, page, pages } });
};

/**
 * POST /api/trash — restore ALL files in trash/ back to staged/.
 */
export const POST: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const paths = getPaths();
  const trashDir = paths.trash;
  let restored = 0;

  try {
    for (const file of fs.readdirSync(trashDir)) {
      const ext = path.extname(file).toLowerCase();
      if (!IMG_EXTS.has(ext)) continue;
      try {
        const stagedName = uniqueFilename(paths.staged, file);
        fs.renameSync(path.join(trashDir, file), path.join(paths.staged, stagedName));
        restored++;
      } catch (e) {
        console.error(`[trash] Failed to restore ${file}:`, (e as Error).message);
      }
    }
  } catch {
    /* empty trash dir or can't read */
  }

  return json({ ok: true, data: { restored } });
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
