import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getImageCount, getTagCount } from "$lib/server/db-query.js";
import { getStagedFiles, getTrashFiles, requireDatabase } from "$lib/server/helpers.js";

/** GET /api/metadata/stats — return collection statistics */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db } = loaded;
  return json({
    ok: true,
    data: {
      totalImages: getImageCount(db),
      totalTags: getTagCount(db),
      stagedCount: getStagedFiles().length,
      trashCount: getTrashFiles().length,
    },
  });
};
