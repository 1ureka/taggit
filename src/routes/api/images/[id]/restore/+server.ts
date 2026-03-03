import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths } from "$lib/server/config.js";
import { isValidId } from "$lib/server/validation.js";

/** POST /api/images/[id]/restore — restore a trashed image */
export const POST: RequestHandler = ({ params }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const trashed = db.getTrashedImage(id);
  if (!trashed) return json({ ok: false, error: "Trashed image not found" }, { status: 404 });

  // Move file from trash → committed
  const paths = getCollectionPaths(db.getCurrentRoot()!);
  const src = path.join(paths.trash, id + trashed.ext);
  const dest = path.join(paths.committed, id + trashed.ext);
  if (fs.existsSync(src)) fs.renameSync(src, dest);

  const restored = db.restoreFromTrash(id);
  return json({ ok: true, data: restored });
};
