import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { queryImages } from "$lib/server/db-query.js";

export const load: PageServerLoad = () => {
  const db = getDB();
  const result = queryImages(db, { sort: "committedAt", order: "desc" });
  return {
    initialItems: result.items,
    initialTotal: result.total,
  };
};
