import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { guardLoaded, getPaths } from "$lib/server/helpers.js";

/** POST /api/maintenance/backup — create a timestamped backup of db.json */
export const POST: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  getDB().flush();

  const paths = getPaths();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(paths.root, `db.backup.${timestamp}.json`);

  try {
    fs.copyFileSync(paths.db, backupPath);
    return json({ ok: true, data: { backupPath } }, { status: 201 });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
};
