import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths } from "$lib/server/config.js";

/** GET /api/maintenance/missing — list DB records whose committed file is missing from disk */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const committed = getCollectionPaths(db.getCurrentRoot()!).committed;
  const missing: string[] = [];

  for (const [id, rec] of db.allImageEntries()) {
    if (!fs.existsSync(path.join(committed, id + rec.ext))) missing.push(id);
  }

  return json({ ok: true, data: { missing } });
};
