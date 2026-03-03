import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths, IMG_EXTS } from "$lib/server/config.js";

/** GET /api/maintenance/orphans — list files in committed/ that have no DB record */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const committed = getCollectionPaths(db.getCurrentRoot()!).committed;
  const orphans: string[] = [];

  for (const file of fs.readdirSync(committed)) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    if (IMG_EXTS.has(ext) && !db.hasImage(base)) orphans.push(file);
  }

  return json({ ok: true, data: { orphans } });
};
