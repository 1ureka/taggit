import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { queryImages } from "$lib/server/db-query.js";

const PAGE_SIZE = 30;

export const load: PageServerLoad = () => {
  const db = getDB();
  const result = queryImages(db, { sort: "committedAt", order: "desc", limit: PAGE_SIZE, page: 1 });
  return {
    initialItems: result.items,
    initialTotal: result.total,
  };
};
