import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidId } from "$lib/server/validation.js";
import { guardLoaded, getPaths } from "$lib/server/helpers.js";

/** POST /api/images/[id]/restore — restore a trashed image */
export const POST: RequestHandler = ({ params }) => {
  const err = guardLoaded();
  if (err) return err;

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const trashed = db.getTrashedImage(id);
  if (!trashed) return json({ ok: false, error: "Trashed image not found" }, { status: 404 });

  const paths = getPaths();
  const src = path.join(paths.trash, id + trashed.ext);
  const dest = path.join(paths.committed, id + trashed.ext);
  if (fs.existsSync(src)) fs.renameSync(src, dest);

  const restored = db.restoreFromTrash(id);
  return json({ ok: true, data: restored });
};
