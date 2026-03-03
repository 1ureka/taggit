import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidId } from "$lib/server/validation.js";
import { guardLoaded, getPaths } from "$lib/server/helpers.js";

/** DELETE /api/trash/[id] — permanently delete a single trashed image */
export const DELETE: RequestHandler = ({ params }) => {
  const err = guardLoaded();
  if (err) return err;

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const trashed = db.getTrashedImage(id);
  if (!trashed) return json({ ok: false, error: "Trashed image not found" }, { status: 404 });

  const fp = path.join(getPaths().trash, id + trashed.ext);
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    /* ignore */
  }

  db.removeTrashedRecord(id);
  return json({ ok: true });
};
