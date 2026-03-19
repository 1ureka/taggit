import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { removeImage } from "$lib/server/db-mutation.js";
import { requireDatabase } from "$lib/server/db-instance.js";

/** GET /api/maintenance/missing — list DB records whose image file is missing from disk */
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

/**
 * DELETE /api/maintenance/missing
 * Removes all DB records whose image file no longer exists on disk.
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
