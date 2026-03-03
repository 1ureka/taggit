import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { IMG_EXTS } from "$lib/server/config.js";
import { guardLoaded, getPaths } from "$lib/server/helpers.js";

/** GET /api/maintenance/orphans — list files in committed/ that have no DB record */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const committed = getPaths().committed;
  const orphans: string[] = [];

  for (const file of fs.readdirSync(committed)) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    if (IMG_EXTS.has(ext) && !db.hasImage(base)) orphans.push(file);
  }

  return json({ ok: true, data: { orphans } });
};
