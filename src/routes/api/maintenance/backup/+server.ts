import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";

/**
 * POST /api/maintenance/backup
 * Creates a timestamped backup of db.json in the collection root.
 */
export const POST: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  try {
    const backupPath = db.backupDb();
    return json({ ok: true, data: { backupPath } }, { status: 201 });
  } catch (e) {
    const err = e as Error;
    return json({ ok: false, error: err.message }, { status: 500 });
  }
};
