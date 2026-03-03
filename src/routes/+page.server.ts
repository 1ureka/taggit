import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { getImageCount, getTagCount } from "$lib/server/db-query.js";
import { getStagedFiles, getTrashFiles } from "$lib/server/helpers.js";

export const load: PageServerLoad = () => {
  const db = getDB();
  return {
    stats: {
      totalImages: getImageCount(db),
      totalTags: getTagCount(db),
      stagedCount: getStagedFiles().length,
      trashCount: getTrashFiles().length,
    },
  };
};
