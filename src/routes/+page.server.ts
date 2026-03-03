import type { PageServerLoad } from "./$types.js";
import * as db from "$lib/server/db.js";
import { getStagedFiles, getTrashFiles } from "$lib/server/helpers.js";

export const load: PageServerLoad = () => {
  return {
    stats: {
      totalImages: db.getImageCount(),
      totalTags: db.getTagCount(),
      stagedCount: getStagedFiles().length,
      trashCount: getTrashFiles().length,
    },
  };
};
