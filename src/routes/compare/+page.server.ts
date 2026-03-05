import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { queryImages } from "$lib/server/db-query.js";

export const load: PageServerLoad = () => {
  const db = getDB();
  const result = queryImages(db, { sort: "random", limit: 2 });
  return {
    pairA: result.items[0] ?? null,
    pairB: result.items[1] ?? null,
    total: result.total,
  };
};
