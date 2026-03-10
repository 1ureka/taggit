import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { allImageEntries } from "$lib/server/db-query.js";
import { removeImage } from "$lib/server/db-mutation.js";
import { requireDatabase } from "$lib/server/helpers.js";

/** GET /api/maintenance/missing — list DB records whose committed file is missing from disk */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const committed = paths.committed;
  const missing: string[] = [];

  for (const [id, rec] of allImageEntries(db)) {
    if (!fs.existsSync(path.join(committed, id + rec.ext))) missing.push(id);
  }

  return json({ ok: true, data: { missing } });
};

/**
 * DELETE /api/maintenance/missing
 * Removes all DB records whose committed file no longer exists on disk.
 */
export const DELETE: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const committed = paths.committed;
  const removed: string[] = [];

  for (const [id, rec] of allImageEntries(db)) {
    if (!fs.existsSync(path.join(committed, id + rec.ext))) {
      removeImage(db, id);
      removed.push(id);
    }
  }

  return json({ ok: true, data: { removed } });
};
