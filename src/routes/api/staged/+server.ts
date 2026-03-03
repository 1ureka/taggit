import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths, IMG_EXTS } from "$lib/server/config.js";

/** GET /api/staged — list staged image filenames */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const staged = getCollectionPaths(db.getCurrentRoot()!).staged;
  try {
    const files = fs
      .readdirSync(staged)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
    return json({ ok: true, data: { files } });
  } catch {
    return json({ ok: true, data: { files: [] } });
  }
};
