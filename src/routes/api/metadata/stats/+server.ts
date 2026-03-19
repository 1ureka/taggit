import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getImageCount, getTagCount } from "$lib/server/db-query.js";
import { getStagedFiles } from "$lib/server/helpers.js";
import { requireDatabase } from "$lib/server/db-instance.js";

/**
 * `GET /api/metadata/stats`
 *
 * 回傳圖片集合的統計資訊（已提交數、標籤數、暫存數）。
 */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  return json({
    ok: true,
    data: {
      totalImages: getImageCount(db),
      totalTags: getTagCount(db),
      stagedCount: getStagedFiles(db, paths).length,
    },
  });
};
