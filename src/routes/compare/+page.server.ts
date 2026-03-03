import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { getAllTags } from "$lib/server/db-query.js";

export const load: PageServerLoad = () => {
  const db = getDB();
  return {
    allTags: getAllTags(db),
  };
};
