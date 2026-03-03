import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths, IMG_EXTS } from "$lib/server/config.js";

/** GET /api/stats — return collection statistics */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const staged = getCollectionPaths(db.getCurrentRoot()!).staged;
  let stagedCount = 0;
  try {
    stagedCount = fs.readdirSync(staged).filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase())).length;
  } catch {
    /* ignore */
  }

  return json({
    ok: true,
    data: {
      totalImages: db.getImageCount(),
      totalTags: db.getTagCount(),
      stagedCount,
      trashCount: db.getTrashCount(),
    },
  });
};
