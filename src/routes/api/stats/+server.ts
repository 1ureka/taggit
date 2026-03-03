import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { guardLoaded, getStagedFiles, getTrashFiles } from "$lib/server/helpers.js";

/** GET /api/stats — return collection statistics */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  return json({
    ok: true,
    data: {
      totalImages: db.getImageCount(),
      totalTags: db.getTagCount(),
      stagedCount: getStagedFiles().length,
      trashCount: getTrashFiles().length,
    },
  });
};
