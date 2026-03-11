import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { getImageCount, getTagCount } from "$lib/server/db-query.js";
import { getStagedFiles, getTrashFiles, requireDatabase } from "$lib/server/helpers.js";

export const load: PageServerLoad = () => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const { db, paths } = loaded;
  return {
    stats: {
      totalImages: getImageCount(db),
      totalTags: getTagCount(db),
      stagedCount: getStagedFiles(paths).length,
      trashCount: getTrashFiles(paths).length,
    },
  };
};
