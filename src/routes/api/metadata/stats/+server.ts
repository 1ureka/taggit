import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { getImageCount, getTagCount } from "$lib/server/db-query.js";
import { guardLoaded, getStagedFiles, getTrashFiles } from "$lib/server/helpers.js";

/** GET /api/metadata/stats — return collection statistics */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const jsonDB = getDB();
  return json({
    ok: true,
    data: {
      totalImages: getImageCount(jsonDB),
      totalTags: getTagCount(jsonDB),
      stagedCount: getStagedFiles().length,
      trashCount: getTrashFiles().length,
    },
  });
};
