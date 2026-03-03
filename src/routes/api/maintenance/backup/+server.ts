import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths } from "$lib/server/config.js";

/** POST /api/maintenance/backup — create a timestamped backup of db.json */
export const POST: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  db.flush();

  const root = db.getCurrentRoot()!;
  const dbPath = getCollectionPaths(root).db;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(root, `db.backup.${timestamp}.json`);

  try {
    fs.copyFileSync(dbPath, backupPath);
    return json({ ok: true, data: { backupPath } }, { status: 201 });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
};
