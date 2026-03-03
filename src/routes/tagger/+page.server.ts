import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { getAllTags } from "$lib/server/db-query.js";
import { getStagedFiles } from "$lib/server/helpers.js";

export const load: PageServerLoad = () => {
  const db = getDB();
  return {
    stagedFiles: getStagedFiles(),
    allTags: getAllTags(db),
  };
};
