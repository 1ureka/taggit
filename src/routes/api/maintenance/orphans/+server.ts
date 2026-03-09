import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { hasImage } from "$lib/server/db-query.js";
import { IMG_EXTS } from "$lib/server/config.js";
import { requireDatabase } from "$lib/server/helpers.js";

/** GET /api/maintenance/orphans — list files in committed/ that have no DB record */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const committed = paths.committed;
  const orphans: string[] = [];

  for (const file of fs.readdirSync(committed)) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    if (IMG_EXTS.has(ext) && !hasImage(db, base)) orphans.push(file);
  }

  return json({ ok: true, data: { orphans } });
};

/**
 * DELETE /api/maintenance/orphans
 * Permanently deletes all orphaned files from committed/ (no DB record exists for them).
 */
export const DELETE: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const committed = paths.committed;
  const deleted: string[] = [];

  for (const file of fs.readdirSync(committed)) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    if (IMG_EXTS.has(ext) && !hasImage(db, base)) {
      try {
        fs.unlinkSync(path.join(committed, file));
        deleted.push(file);
      } catch (e) {
        console.error(`[orphans] Failed to delete ${file}:`, (e as Error).message);
      }
    }
  }

  return json({ ok: true, data: { deleted } });
};
