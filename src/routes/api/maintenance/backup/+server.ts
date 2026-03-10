import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { requireDatabase } from "$lib/server/helpers.js";

/** POST /api/maintenance/backup — create a timestamped backup of db.json */
export const POST: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  db.flush();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(paths.root, `db.backup.${timestamp}.json`);

  try {
    fs.copyFileSync(paths.db, backupPath);
    return json({ ok: true, data: { backupPath } }, { status: 201 });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
};
