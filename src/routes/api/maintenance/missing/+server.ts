import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { allImageEntries } from "$lib/server/db-query.js";
import { removeImage } from "$lib/server/db-mutation.js";
import { guardLoaded, getPaths } from "$lib/server/helpers.js";

/** GET /api/maintenance/missing — list DB records whose committed file is missing from disk */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const committed = getPaths().committed;
  const missing: string[] = [];

  for (const [id, rec] of allImageEntries(getDB())) {
    if (!fs.existsSync(path.join(committed, id + rec.ext))) missing.push(id);
  }

  return json({ ok: true, data: { missing } });
};

/**
 * DELETE /api/maintenance/missing
 * Removes all DB records whose committed file no longer exists on disk.
 */
export const DELETE: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const committed = getPaths().committed;
  const removed: string[] = [];

  for (const [id, rec] of allImageEntries(getDB())) {
    if (!fs.existsSync(path.join(committed, id + rec.ext))) {
      removeImage(getDB(), id);
      removed.push(id);
    }
  }

  return json({ ok: true, data: { removed } });
};
