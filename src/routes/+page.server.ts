import fs from "fs";
import path from "path";
import type { PageServerLoad } from "./$types.js";
import * as db from "$lib/server/db.js";
import { getCollectionPaths, IMG_EXTS } from "$lib/server/config.js";

export const load: PageServerLoad = () => {
  let stagedCount = 0;
  const root = db.getCurrentRoot();
  if (root) {
    try {
      stagedCount = fs
        .readdirSync(getCollectionPaths(root).staged)
        .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase())).length;
    } catch {
      /* ignore */
    }
  }

  return {
    stats: {
      totalImages: db.getImageCount(),
      totalTags: db.getTagCount(),
      stagedCount,
      trashCount: db.getTrashCount(),
    },
  };
};
