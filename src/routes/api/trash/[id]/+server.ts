import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths } from "$lib/server/config.js";
import { isValidId } from "$lib/server/validation.js";

/** DELETE /api/trash/[id] — permanently delete a single trashed image */
export const DELETE: RequestHandler = ({ params }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const trashed = db.getTrashedImage(id);
  if (!trashed) return json({ ok: false, error: "Trashed image not found" }, { status: 404 });

  // Delete file
  const fp = path.join(getCollectionPaths(db.getCurrentRoot()!).trash, id + trashed.ext);
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    /* ignore */
  }

  db.removeTrashedRecord(id);
  return json({ ok: true });
};
